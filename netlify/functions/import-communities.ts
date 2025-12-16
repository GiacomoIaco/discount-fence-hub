import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// Community data extracted from QBO export (Parent:Child format)
const COMMUNITIES: Record<string, string[]> = {
  "Arbogast Homes": ["Lakeway - Arbogast", "Spanish Oaks - Arbogast", "The Summit - Arbogast"],
  "Ash Creek Homes, Inc": ["Drew Lane", "Tanner Ranch - Ash Creek", "The Heights at Vista Park"],
  "Ashton Woods Homes": ["Berry Creek", "Cordova Trails Ashton SA", "Front Gate - Ashton SA", "Hennersby Hollow - Ashton Woods SA", "Hiddenbrook -SA", "Kinder Ranch -SA", "Lariat", "Meridian - Ashton Wood", "Saddle Brook -SA", "Trails At Culebra - Ashton SA", "Vista Ridge -SA", "Wilder"],
  "CastleRock Communities": ["Acadia Ridge", "Hennersby Hollow", "Homestead", "Mesa Vista"],
  "Chesmar Homes": ["Broken Oak - Chesmar", "Carillon - Chesmar", "Chesmar - Briarwood", "Deer Brook - Chesmar Home", "Feather Grass", "Highland Village", "Lariat - Chesmar", "Manor Commons - Chesmar Homes", "Nolinar - Chesmar", "Oak Brook - Chesmar", "Santa Rita - Chesmar", "Village at Manor Commons"],
  "Clark Wilson Builders": ["210 Creek Road - Clark", "Dripping Springs - Clark Wilson", "Onion creek of Driftwood", "Sommerville - Clark Wilson", "Sommery - Clark Wilson", "Summerville", "The Landing at Lakeway", "The View"],
  "D.R. Horton": ["Highland Court", "Murphy Village"],
  "David Weekely Homes": ["Adelton", "Davis Ranch - SA", "Kinder Ranch - David Weekley", "Ladera", "Meyer Ranch -David Weekely - SA", "THE COLONY", "Veramendi", "Windsong"],
  "Drees Custom Homes": ["120 Magnolia Ranch Lane", "16905 Muguet", "Build on your lot - Drees", "Caliterra - Drees", "Canyon Pass", "Clearwater - Drees", "Drees - Drees Custom Homes", "Golden Bear - Drees", "Headwaters", "HillTop Ranch", "Hollows", "Hollows at Lake travis - Drees Custom Homes", "La Brias - Drees", "Lakeside at Tessera - Drees", "Lakeside Estates", "Lariat - Drees Custom Homes", "Las Brisas", "Marilyn Drees", "McCormick Mountain", "Northgate Ranch - Drees", "Parmer Ranch", "Provence-Drees", "Rancho Sante Fe", "Rough Hollow Vista Ridge-Drees", "San Gabriel Oaks", "Santa Rita Ranch - Drees", "Summit", "Sweetwater - Drees", "Tessera - Drees", "The District - Drees", "The Hollows - Drees", "Travisso", "Wolf Ranch - Drees"],
  "Empire Communities": ["Adelton - Empire", "Blanco Vista - Empire", "Cibolo Canyon - Empire SA", "Cool Water", "Double Eagle Ranch - Empire", "Everly Estates", "Goodnight Ranch - Empire", "Goodnight Ranch(Paseo Court) - Empire", "Mueler Gardens - Empire", "Mueller", "Plum Creek"],
  "GFO Homes": ["Bluffview - GFO", "Bluffview Reserve", "Crecent bluff -GFO", "Enclave at Celo", "Heights at San Gabriel-GFO", "Highland Village-GFO", "Saddleback Santa Rita - GFO"],
  "Giddens Custom Homes": ["Clearwater Ranch - Giddens", "Hollow Canyons", "Long Hollow Estates - Giddens", "Northgate Ranch - Giddens", "Santa Rita Ranch - Giddens", "Whispering Wind"],
  "Grandview Custom Homes": ["20200 Siesta Shores Dr", "Peninsula - Grandview Custom Homes"],
  "Highland Homes": ["6 Creeks - Highland", "Broken Oak - Highland", "Bryson - Highland", "Carmel Creek", "Crosswinds - Highland", "Easton Park", "Flora - Highland Homes", "Gruene Villages - Highlands", "Highpointe - Highland", "La Cima - Highland", "Lakeside at Tessera - Highland", "Lakeside - Highland", "Lariat", "Legacy at Dunlap Lake - Highland", "Legacy - Highland", "Mason Hills", "Mayfair - Highland", "Mayfield Ranch", "Meyers Ranch - Highland", "Palmera Bluff", "Palmera Ridge - Highland", "Paloma Lake", "Parkside on the River - Highland", "Parten Ranch -- Highland", "Santa Rita Ranch - Highland", "Sunflower Ridge", "Tessera", "Veramendi - Highland", "Whitaker - Highlands", "Wolf Ranch - Highland"],
  "Homebound Technolgies": ["Central Austin - Homebound", "Driftwood Golf Club - Homebound", "East Austin -Homeebound", "North Austin - Homebound", "South Austin - Homebound"],
  "Landsea Homes": ["ANTHEM", "Manor Commons - Landsea"],
  "Lennar Homes": ["Applewood", "Artavia", "Binford Creek", "Brookmill", "Canterra Creek", "Crosby Farms", "Dellrose", "Gatehouse", "Harrington Trails", "Hunter Ranch", "Ladera Trails", "Lennar - Fairwater", "Lennar - Grace Gardens", "Lennar Homes - Ladera", "Lennar-Kresston", "Lennar- Sweetwater Ridge", "Magnolia Forest", "Moran Ranch", "Pinewood Trails", "River Ranch", "SKY RANCH", "Spring Branch Crossing", "Sunterra", "Tavola West", "Tobey Ridge - Lennar SA", "Voss Hilltop - Lennar SA"],
  "LGI Homes": ["Eagles Landing", "Villas Canyon Ranch"],
  "M/I Homes": ["Barksdale - M/I", "Chapparal Ranch", "Edgewood - M/I Homes", "Edgewood - M/I Homes:3618 Prosper", "Paloma Park", "Parkside on the River - M/I", "Summer Hills - M/I SA"],
  "Masonwood Development": ["Cielo East - Masonwood", "Kelly Villas - Masonwood", "Paleface Ranch", "Park at Wells Branch", "South St. Villas"],
  "MHI Homes": ["6 Creeks - MHI", "Belterra", "Buffalo Crossing - MHI", "Caneros Ranch-MHI", "Double Eagle Ranch - MHI", "East Park - MHI", "Foxbrook - MHI", "Headwaters-MHI", "La Cima - MHI", "Lakeside at Lake Georgetown - MHI", "Luxury on the Lake - MHI", "MHI Homes - Palmer Bluff", "MHI - Parmer Ranch", "Palmera Bluff - MHI", "Palmera Ridge - MHI", "Parkside on the River - MHI", "Rhine Valley - MHI", "Santa Rita Ranch - MHI", "Sunflower Ridge MHI SA", "The Colony - MHI", "THe Parklands MHI SA", "Veramendi - MHI SA", "Wolf Ranch - MHI", "Wolf Ranch - MHI - Deck"],
  "Milestone Community Builders": ["Bonnet Estate - Milestone Community Builders", "Collins", "Crosswinds  Temp Fence- Milestone", "Enclave @ Lagos", "Foxfield - Milestone", "Foxfiled - Milestone", "Gardens at Mayfield", "Koening - Milestone", "Larkspur", "Layola - Milestone", "Loyola - Milestone", "Marshall Ranch", "Messenger", "Messinger - Milestone", "Messinger Milestone Community Builders", "Milky Way at Riverplace", "M Signature - River Place", "Overlook", "Porter Country", "QuickRanch", "River Place - Milestone", "Sage Hollows", "Skyridge", "Sunshine Camps -Milestone", "The Grove", "Vistas of Austin", "Wilson - Milestone"],
  "New Home Co.": ["Oakberry Trails", "The Canopies"],
  "Nexstep Homes, LLC dba Thurman Homes": ["Central Austin - Thurman Homes", "Whisper Valley - Thurman"],
  "Perry Homes": ["6 Creeks - Perry", "Alsatian Oaks", "Balcones", "Balcones-Perry", "Bison Ridge Perry SA", "Briggs Ranch", "Bryson - Perry", "Carpenter Hill Perry  SA", "Corley Farms - Perry SA", "Easton Park - Perry", "Esperanza - Perry", "Flora", "Haby Hills", "Hidden Canyon", "Highpointe - Perry", "Kallison Ranch -SA", "Kinder Ranch", "La Cima 60' - Perry SA", "Ladera 40's - Perry SA", "Ladera - Perry SA", "Lariat", "Lariat 45' - Perry SA", "Nolina", "Palmera Bluff Perry", "Palmera Ridge dont use", "Parkside on the Peninsula - Perry SA", "Parkside on the River - Perry", "Parmer Ranch", "Ranches at Creekside - Perry SA", "Rancho Sienna - Perry", "River Rock Ranch", "River Valley Perry SA", "Santa Rita Ranch - Perry", "Shadowglen", "Stevens Ranch - Perry SA", "Stillwater Ranch - Perry SA", "Sweetwater - Perry", "The Colony - Perry", "The Dominion", "Trails at Westpointe", "Veramendi - Perry SA", "Veranda - Perry SA", "Vida", "Vida - Perry SA", "Wolf Ranch"],
  "Pulte Homes": ["East Park - Pulte", "Gregg Ranch - Pulte", "Horizon Lake", "Patterson Ranch - Pulte", "Reserve at North Fork"],
  "Rausch Coleman": ["Hidden Oasis - Rausch", "Randolph Crossing - SA", "Ridge View - Rausch Coleman", "Zarzamora Cove"],
  "Richmond American": ["Blanco Vista - Richmond", "Seasons at Blanco Vista", "Seasons at Calumet", "Seasons at Carillon", "Seasons at Railhead - Richmond American", "Whisper Highlands", "Whisper Valley"],
  "Scott Felder Homes": ["Arbors At Fair Oaks Ranch", "Avondale Scott Felder -SA", "Esperanza - Scott Felder", "Grove at Vintage Oaks", "Hidden Trails", "Maddison - Scott Felder", "Meyers Ranch - Scott SA", "Parkhill Commons - Scott Felder SA", "The Crossvine", "Vintage Oaks - SFH", "Vistas - Scott Felder", "Willowbrook Scott Felder SA", "Windsong"],
  "Sendero Homes": ["Lakeway - Sendero", "Madrone Canyon", "Signal Hill"],
  "Southerly Homes": ["Cental Austin - Southerly", "South Austin - Southerly Homes", "West Austin - Southerly"],
  "Starlight Homes": ["Cordova Trails Starlight SA", "Hennersby Hollow", "Trails at Culebra - Starlight SA"],
  "Tri Pointe Homes": ["Bar W Ranch", "Bryson - Tri Pointe", "Central Park-Tri Pointe", "FLORA", "Heritage - Tri Pointe", "Homestead at Old Settlers - Tri Pointe", "Lagos", "Lariat - Tri Pointe", "Meyer Ranch", "Meyers Ranch - Tri", "Oaks at San Gabriel - Tri Pointe", "Retreat at San Gabriel - Tri Pointe", "Turners Crossing"],
  "Westin Homes": ["Provence - Westin", "San Gabriel Oaks - Westin", "Sweetwater - Westin", "Tessera - Westin", "The Colony - Westin", "The Summit - Westin", "Wolf Ranch"],
};

/**
 * Import communities from pre-extracted QBO data
 * GET /.netlify/functions/import-communities?dryRun=true  (preview)
 * GET /.netlify/functions/import-communities              (execute)
 */
export const handler: Handler = async (event) => {
  const dryRun = event.queryStringParameters?.dryRun === 'true';

  try {
    // Get all clients to map builder names to client IDs
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('business_unit', 'builders');

    if (clientsError) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch clients', details: clientsError }),
      };
    }

    const clientMap = new Map<string, string>();
    for (const client of clients || []) {
      clientMap.set(client.name, client.id);
    }

    const results: { builder: string; clientId: string | null; communitiesCreated: number; error?: string }[] = [];
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const [builderName, communities] of Object.entries(COMMUNITIES)) {
      const clientId = clientMap.get(builderName);
      const result = { builder: builderName, clientId, communitiesCreated: 0, error: undefined as string | undefined };

      if (!clientId) {
        result.error = 'Client not found';
        results.push(result);
        continue;
      }

      for (const communityName of communities) {
        if (!dryRun) {
          // Check if community already exists
          const { data: existing } = await supabase
            .from('communities')
            .select('id')
            .eq('client_id', clientId)
            .eq('name', communityName)
            .single();

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Insert new community
          const { error: insertError } = await supabase
            .from('communities')
            .insert({
              client_id: clientId,
              name: communityName,
              status: 'active',
            });

          if (insertError) {
            result.error = `Insert error: ${insertError.message}`;
          } else {
            result.communitiesCreated++;
            totalCreated++;
          }
        } else {
          result.communitiesCreated++;
        }
      }

      results.push(result);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun,
        summary: {
          totalBuilders: Object.keys(COMMUNITIES).length,
          totalCommunities: Object.values(COMMUNITIES).flat().length,
          communitiesCreated: dryRun ? Object.values(COMMUNITIES).flat().length : totalCreated,
          communitiesSkipped: dryRun ? 0 : totalSkipped,
        },
        results,
      }, null, 2),
    };
  } catch (error) {
    console.error('Import Communities Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
