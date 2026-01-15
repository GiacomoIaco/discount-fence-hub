const fs = require('fs');
const filePath = 'src/features/fsm/components/QuoteCard/QuoteLineItems.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the unit cost display section
const oldCode = `                  ) : (
                    <span className={\`text-sm text-right block \${item.sku_id ? 'text-gray-500 bg-gray-50 px-2 py-1 rounded' : 'text-gray-900'}\`}>
                      \${formatCurrency(item.unit_cost)}
                    </span>
                  )}
                </div>

                {/* Line Total */}`;

const newCode = `                  ) : (
                    <div className="text-right">
                      <span className={\`text-sm block \${item.sku_id ? 'text-gray-500' : 'text-gray-900'}\`}>
                        \${formatCurrency(item.unit_cost)}
                      </span>
                      {item.sku_id && item.material_unit_cost !== undefined && item.labor_unit_cost !== undefined && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          M: \${formatCurrency(item.material_unit_cost)} L: \${formatCurrency(item.labor_unit_cost)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Line Total */}`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated QuoteLineItems.tsx');
