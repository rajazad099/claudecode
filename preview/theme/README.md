# Preview theme placement

`page.json` is uploaded to the **unpublished** preview theme as
`templates/page.json`, which puts the fitting quiz above the content of any page
using the default page template. It exists here only so the upload has a URL to
fetch from — Shopify's `themeFilesUpsert` takes a URL body, which avoids pasting
the file through the API.

It is **not** part of the section. Nothing here is uploaded to the live theme.
