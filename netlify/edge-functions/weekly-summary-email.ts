import type { Context } from "https://edge.netlify.com/";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateWeeklySummaryHTML } from "./lib/emailTemplate.ts";

export default async (request: Request, context: Context) => {
  // Only allow POST requests
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Verify the request is from a scheduled function (using a secret key)
    const authHeader = request.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email settings
    const { data: settings, error: settingsError } = await supabase
      .from("project_settings")
      .select("setting_value")
      .eq("setting_key", "email_schedule")
      .single();

    if (settingsError || !settings?.setting_value?.isEnabled) {
      return new Response(
        JSON.stringify({ message: "Email notifications are disabled" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const emailConfig = settings.setting_value;

    // Calculate week range
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    // Get all functions with their high-priority initiatives
    const { data: functions, error: functionsError } = await supabase
      .from("project_functions")
      .select(`
        id,
        name,
        description
      `)
      .eq("is_active", true)
      .order("sort_order");

    if (functionsError) throw functionsError;

    // For each function, get high priority initiatives
    const functionsData = await Promise.all(
      (functions || []).map(async (func) => {
        const { data: initiatives, error: initiativesError } = await supabase
          .from("project_initiatives")
          .select(`
            id,
            title,
            description,
            status,
            priority,
            color_status,
            progress_percent,
            assigned_user:user_profiles(full_name),
            bucket:project_buckets(name)
          `)
          .eq("priority", "high")
          .is("archived_at", null);

        if (initiativesError) throw initiativesError;

        return {
          name: func.name,
          initiatives: initiatives || [],
        };
      })
    );

    // Filter out functions with no initiatives
    const functionsWithInitiatives = functionsData.filter(
      (f) => f.initiatives.length > 0
    );

    if (functionsWithInitiatives.length === 0) {
      return new Response(
        JSON.stringify({ message: "No high priority initiatives to report" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate email HTML
    const emailHTML = generateWeeklySummaryHTML(
      formatDate(weekStart),
      formatDate(weekEnd),
      functionsWithInitiatives
    );

    // Determine recipients
    let recipients: string[] = [];

    if (emailConfig.recipientType === "custom") {
      recipients = emailConfig.customEmails
        .split("\n")
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0);
    } else if (emailConfig.recipientType === "all_leadership") {
      // Get all users with function access
      const { data: accessRecords, error: accessError } = await supabase
        .from("project_function_access")
        .select("user:user_profiles(email)")
        .not("user_id", "is", null);

      if (accessError) throw accessError;

      const uniqueEmails = new Set<string>();
      accessRecords?.forEach((record: any) => {
        if (record.user?.email) {
          uniqueEmails.add(record.user.email);
        }
      });

      recipients = Array.from(uniqueEmails);
    } else if (emailConfig.recipientType === "per_function") {
      // For now, treat same as all_leadership
      // TODO: Implement per-function email logic
      const { data: accessRecords, error: accessError } = await supabase
        .from("project_function_access")
        .select("user:user_profiles(email)")
        .not("user_id", "is", null);

      if (accessError) throw accessError;

      const uniqueEmails = new Set<string>();
      accessRecords?.forEach((record: any) => {
        if (record.user?.email) {
          uniqueEmails.add(record.user.email);
        }
      });

      recipients = Array.from(uniqueEmails);
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients configured" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Resend API key not configured");
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Leadership Weekly Summary <giacomo@discountfenceusa.com>",
        to: recipients,
        subject: `Weekly Leadership Summary - ${formatDate(weekStart)} to ${formatDate(weekEnd)}`,
        html: emailHTML,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      throw new Error(`Resend error: ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Weekly summary sent to ${recipients.length} recipient(s)`,
        recipients: recipients.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending weekly summary:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config = {
  path: "/api/weekly-summary-email",
};
