# Power Platform Bookmarklets

Quick browser tools for Power Platform devs.

## 🛠️ How to install

**👉 [Go to installation page](https://jukkan.github.io/power-bookmarklets)**

Drag bookmarklets from that page to your browser's bookmarks bar. Don't use the raw .js files in the repo.

## Bookmarklets (just one for now...)

### 📋 Get Table Metadata

Extracts Dataverse table schema from a model-driven app view and copies it as a markdown table. Perfect for pasting into AI tools like Claude, Copilot, or ChatGPT.

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

