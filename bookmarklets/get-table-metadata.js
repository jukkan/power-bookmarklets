// Get Table Metadata for Dataverse
// Usage: Navigate to a table view in a model-driven app, then click this bookmarklet
// Output: Markdown table copied to clipboard (excludes system fields)

(function() {
  const entityName = new URLSearchParams(window.location.search).get('etn');
  
  if (!entityName) {
    return alert('No entity in URL. Go to a table view first.');
  }
  
  const apiUrl = window.location.origin + 
    `/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')` +
    `?$select=LogicalName&$expand=Attributes($select=LogicalName,DisplayName,AttributeType)`;
  
  fetch(apiUrl)
    .then(r => r.json())
    .then(data => {
      // Filter out system fields
      const systemFieldsRegex = /^(created|modified|owner|owning|statecode|statuscode|versionnumber|importsequencenumber|overriddencreatedon|timezoneruleversionnumber|utcconversiontimezonecode)/;
      
      const rows = data.Attributes
        .filter(attr => !attr.LogicalName.match(systemFieldsRegex))
        .map(attr => {
          const displayName = attr.DisplayName?.LocalizedLabels?.[0]?.Label || '';
          return `| ${attr.LogicalName} | ${displayName} | ${attr.AttributeType} |`;
        })
        .join('\n');
      
      const markdownTable = 
        `**Table: ${entityName}**\n\n` +
        `| LogicalName | DisplayName | AttributeType |\n` +
        `|-------------|-------------|---------------|\n` +
        rows;
      
      navigator.clipboard.writeText(markdownTable)
        .then(() => {
          alert(
            `✓ Schema copied!\n\n` +
            `${data.Attributes.length} total, ${rows.split('\n').length} shown`
          );
        });
    })
    .catch(err => alert('Error: ' + err.message));
})();
