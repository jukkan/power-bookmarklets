# Power Platform Bookmarklets

Quick browser tools for Power Platform devs. Drag to your bookmarks bar or click to install.

## 📋 Get Table Metadata

Extracts Dataverse table schema from a model-driven app view and copies it as a markdown table (perfect for pasting into AI tools like Claude, Copilot, or ChatGPT).

**Install:** Drag this to your bookmarks bar:  
👉 [Get Table Metadata](javascript:(function(){const e=new URLSearchParams(window.location.search).get('etn');if(!e)return alert('No entity in URL. Go to a table view first.');const t=window.location.origin+`/api/data/v9.2/EntityDefinitions(LogicalName='${e}')?$select=LogicalName&$expand=Attributes($select=LogicalName,DisplayName,AttributeType)`;fetch(t).then(r=>r.json()).then(d=>{const rows=d.Attributes.filter(a=>!a.LogicalName.match(/^(created|modified|owner|owning|statecode|statuscode|versionnumber|importsequencenumber|overriddencreatedon|timezoneruleversionnumber|utcconversiontimezonecode)/)).map(a=>`| ${a.LogicalName} | ${a.DisplayName?.LocalizedLabels?.[0]?.Label||''} | ${a.AttributeType} |`).join('\n');const table=`**Table: ${e}**\n\n| LogicalName | DisplayName | AttributeType |\n|-------------|-------------|---------------|\n${rows}`;navigator.clipboard.writeText(table).then(()=>alert(`✓ Schema copied!\n\n${d.Attributes.length} total, ${rows.split('\n').length} shown`))}).catch(err=>alert('Error: '+err.message))})();)

**Usage:**  
1. Navigate to a table view in a model-driven app  
2. Click the bookmarklet  
3. Schema is copied to clipboard  

**Output example:**  
```markdown
**Table: pre_mytablename**
| LogicalName | DisplayName | AttributeType |
|-------------|-------------|---------------|
| pre_name | Task Name | String |
| pre_notes | Notes | Memo |
| pre_actualdate | Actual Date | DateTime |
| pre_year | Year | Integer |
| pre_parentrecordid | Parent Record | Uniqueidentifier |
| pre_displaysequence | Display Sequence | Decimal |
...
```

**What it does:**
- Filters out system fields (created, modified, owner, etc.)
- Uses Web API `v9.2` (works on most environments)
- Copies to clipboard automatically

**Source:** [`bookmarklets/get-table-metadata.js`](bookmarklets/get-table-metadata.js)

---

## 🛠️ How to Install Bookmarklets

### Method 1: Drag and drop (easiest)
1. Show your bookmarks bar (Ctrl+Shift+B in most browsers)
2. Drag the bookmarklet link above to the bar

### Method 2: Manual
1. Right-click bookmarks bar → Add page/bookmark
2. Name: `Get Table Metadata`
3. URL: Copy the code from the `.js` file or the encoded link above

---

## ⚠️ Caveats
- Requires read access to Dataverse Web API
- Only works on model-driven apps (not canvas apps)
- Filters common system fields—adjust regex in source if you need them

---

## 🤝 Contributing
Found a bug or have a new bookmarklet idea? Open an issue or PR!

---

## 📄 License
MIT (or Unlicense if you prefer total freedom)
