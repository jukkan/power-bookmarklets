// Get Table Metadata for Dataverse (with Choice/Picklist values)
// Usage: Navigate to a table view in a model-driven app, then click this bookmarklet
// Output: Markdown table copied to clipboard (excludes system fields, includes choice options)

(function() {
  const entityName = new URLSearchParams(window.location.search).get('etn');
  
  if (!entityName) {
    return alert('No entity in URL. Go to a table view first.');
  }
  
  const baseUrl = window.location.origin + `/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')`;
  
  // Fetch basic attributes
  const attrUrl = `${baseUrl}?$select=LogicalName&$expand=Attributes($select=LogicalName,DisplayName,AttributeType)`;
  
  // Fetch picklist attributes with options (requires casting)
  const picklistUrl = `${baseUrl}/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`;
  
  Promise.all([
    fetch(attrUrl).then(r => r.json()),
    fetch(picklistUrl).then(r => r.json())
  ])
  .then(([attrData, picklistData]) => {
    // Build lookup map of picklist options
    const picklistOptions = {};
    picklistData.value.forEach(p => {
      if (p.OptionSet?.Options) {
        picklistOptions[p.LogicalName] = p.OptionSet.Options
          .map(o => {
            const label = o.Label?.LocalizedLabels?.[0]?.Label || o.Value;
            return `${o.Value}: ${label}`;
          })
          .join(', ');
      }
    });
    
    // Filter out system fields
    const systemFieldsRegex = /^(created|modified|owner|owning|statecode|statuscode|versionnumber|importsequencenumber|overriddencreatedon|timezoneruleversionnumber|utcconversiontimezonecode)/;
    
    const rows = attrData.Attributes
      .filter(attr => !attr.LogicalName.match(systemFieldsRegex))
      .map(attr => {
        const displayName = attr.DisplayName?.LocalizedLabels?.[0]?.Label || '';
        const options = picklistOptions[attr.LogicalName] 
          ? ` [${picklistOptions[attr.LogicalName]}]` 
          : '';
        return `| ${attr.LogicalName} | ${displayName} | ${attr.AttributeType}${options} |`;
      })
      .join('\n');
    
    const markdownTable = 
      `**Table: ${entityName}**\n\n` +
      `| LogicalName | DisplayName | AttributeType |\n` +
      `|-------------|-------------|---------------|\n` +
      rows;
    
    navigator.clipboard.writeText(markdownTable)
      .then(() => {
        const picklistCount = Object.keys(picklistOptions).length;
        alert(
          `✓ Schema copied!\n\n` +
          `${attrData.Attributes.length} total, ${rows.split('\n').length} shown\n` +
          `${picklistCount} choice fields with options`
        );
      });
  })
  .catch(err => alert('Error: ' + err.message));
})();