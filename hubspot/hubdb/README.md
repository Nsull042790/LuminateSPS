# HubDB Setup for Property Generator

## Table: `property_listings`

Create this table in HubSpot: **Marketing → Files and Templates → HubDB → Create table**

### Table Settings
- **Name:** `property_listings`
- **Label:** Property Listings
- **Allow public API access:** Yes
- **Enable for dynamic pages:** Yes

### Columns

| Column Name | Label | Type | Required | Notes |
|-------------|-------|------|----------|-------|
| `name` | Name | Text | Yes | Built-in HubDB column |
| `slug` | Slug | Text | Yes | For dynamic page URL (e.g., "123-main-st-austin") |
| `address` | Address | Text | Yes | Street address |
| `address_2` | Address 2 | Text | No | Apt / Suite / Unit |
| `city` | City | Text | Yes | |
| `state` | State | Text | Yes | |
| `zip` | ZIP Code | Text | Yes | |
| `price` | Price | Number | Yes | |
| `bedrooms` | Bedrooms | Number | No | |
| `bathrooms` | Bathrooms | Text | No | Can be "2.5" etc |
| `sqft` | Square Feet | Number | No | |
| `year_built` | Year Built | Number | No | |
| `mls_number` | MLS Number | Text | No | |
| `open_house_date` | Open House Date | Date | No | Written as ms epoch timestamp |
| `open_house_start` | Open House Start | Text | No | e.g. "1:00 PM" |
| `open_house_end` | Open House End | Text | No | e.g. "3:00 PM" |
| `description` | Description | Rich Text | No | Property description |
| `features` | Features | Text | No | Comma-separated list |
| `photos` | Photos | Text | No | JSON array of photo URLs |
| `realtor_name` | Realtor Name | Text | Yes | |
| `realtor_title` | Realtor Title | Text | No | |
| `realtor_company` | Realtor Company | Text | No | |
| `realtor_phone` | Realtor Phone | Text | No | |
| `realtor_email` | Realtor Email | Text | No | |
| `realtor_license` | Realtor License | Text | No | |
| `realtor_photo` | Realtor Photo | Text | No | Photo URL |
| `realtor_website` | Realtor Website | Text | No | |
| `realtor_logo` | Realtor Logo | Text | No | Company logo URL |
| `lo_name` | Loan Officer Name | Text | Yes | |
| `lo_title` | Loan Officer Title | Text | No | |
| `lo_company` | Loan Officer Company | Text | No | |
| `lo_phone` | Loan Officer Phone | Text | No | |
| `lo_email` | Loan Officer Email | Text | No | |
| `lo_nmls` | Loan Officer NMLS | Text | No | |
| `lo_photo` | Loan Officer Photo | Text | No | Photo URL |
| `lo_website` | Loan Officer Website | Text | No | |
| `show_neighborhood` | Show Neighborhood | Boolean | No | Default: false |
| `walk_score` | Walk Score | Number | No | |
| `transit_score` | Transit Score | Number | No | |
| `bike_score` | Bike Score | Number | No | |
| `amenities` | Amenities | Text | No | |
| `created_by_email` | Created By | Text | Yes | User's email for filtering |
| `created_by_name` | Created By Name | Text | No | User's display name |

### Dynamic Page Setup

After creating the table:

1. Go to **Marketing → Website → Website Pages**
2. Create a new page using the `property-detail.html` template
3. In page settings, enable **"Use HubDB table for dynamic pages"**
4. Select the `property_listings` table
5. Set the URL path to: `properties/{{ row.slug }}`

### API Endpoints

Once created, the table will be accessible via:
- **Table ID:** Found in HubDB settings (e.g., `12345678`)
- **API:** `https://api.hubapi.com/cms/v3/hubdb/tables/{tableId}/rows`
