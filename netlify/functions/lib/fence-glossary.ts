/**
 * Fence-industry bilingual glossary for translation accuracy.
 * Used as context for the translation model to ensure domain-specific terms
 * are translated correctly between English and Spanish.
 */

export const FENCE_GLOSSARY: Record<string, string>[] = [
  // Materials
  { en: 'cedar picket', es: 'estaca de cedro' },
  { en: 'chain link', es: 'malla ciclónica' },
  { en: 'wrought iron', es: 'hierro forjado' },
  { en: 'vinyl fence', es: 'cerca de vinilo' },
  { en: 'wood fence', es: 'cerca de madera' },
  { en: 'privacy fence', es: 'cerca de privacidad' },
  { en: 'picket fence', es: 'cerca de estacas' },
  { en: 'split rail', es: 'riel partido' },
  { en: 'post', es: 'poste' },
  { en: 'rail', es: 'riel' },
  { en: 'panel', es: 'panel' },
  { en: 'gate', es: 'puerta / portón' },
  { en: 'gate latch', es: 'cerrojo de puerta' },
  { en: 'gate hinge', es: 'bisagra de puerta' },
  { en: 'concrete', es: 'concreto' },
  { en: 'gravel', es: 'grava' },
  { en: 'top cap', es: 'tapa superior' },
  { en: 'kickboard', es: 'tabla inferior / zócalo' },
  { en: 'trim board', es: 'tabla de moldura' },
  { en: 'stain', es: 'tinte / sellador' },
  { en: 'galvanized', es: 'galvanizado' },

  // Construction / Tools
  { en: 'post hole', es: 'agujero para poste' },
  { en: 'post hole digger', es: 'excavadora de postes' },
  { en: 'auger', es: 'barrena' },
  { en: 'string line', es: 'hilo guía' },
  { en: 'level', es: 'nivel' },
  { en: 'linear foot', es: 'pie lineal' },
  { en: 'linear feet', es: 'pies lineales' },
  { en: 'square foot', es: 'pie cuadrado' },
  { en: 'tear out', es: 'demolición / retiro' },
  { en: 'demo', es: 'demolición' },
  { en: 'set posts', es: 'colocar postes' },
  { en: 'hang panels', es: 'colgar paneles' },

  // Operations / Logistics
  { en: 'staging area', es: 'área de preparación' },
  { en: 'yard', es: 'patio / almacén' },
  { en: 'crew', es: 'cuadrilla' },
  { en: 'crew lead', es: 'líder de cuadrilla' },
  { en: 'foreman', es: 'capataz' },
  { en: 'job site', es: 'sitio de trabajo' },
  { en: 'BOM', es: 'lista de materiales' },
  { en: 'bill of materials', es: 'lista de materiales' },
  { en: 'pick list', es: 'lista de recolección' },
  { en: 'load out', es: 'carga de salida' },
  { en: 'delivery', es: 'entrega' },
  { en: 'schedule', es: 'programa / horario' },

  // Business
  { en: 'estimate', es: 'presupuesto' },
  { en: 'quote', es: 'cotización' },
  { en: 'invoice', es: 'factura' },
  { en: 'change order', es: 'orden de cambio' },
  { en: 'scope of work', es: 'alcance de trabajo' },
  { en: 'property line', es: 'línea de propiedad' },
  { en: 'easement', es: 'servidumbre' },
  { en: 'HOA', es: 'asociación de propietarios' },
  { en: 'permit', es: 'permiso' },
  { en: 'inspection', es: 'inspección' },
  { en: 'homeowner', es: 'propietario' },
  { en: 'builder', es: 'constructor' },
  { en: 'subdivision', es: 'fraccionamiento' },
];

/**
 * Format glossary as a reference string for the translation prompt.
 */
export function formatGlossaryForPrompt(sourceLang: string, targetLang: string): string {
  const fromKey = sourceLang === 'es' ? 'es' : 'en';
  const toKey = targetLang === 'es' ? 'es' : 'en';

  if (fromKey === toKey) return '';

  const entries = FENCE_GLOSSARY
    .map(entry => `  ${entry[fromKey]} → ${entry[toKey]}`)
    .join('\n');

  return `FENCE INDUSTRY GLOSSARY (use these translations for domain-specific terms):\n${entries}`;
}
