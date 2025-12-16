# Property Site Generator - Technical Specification

**Version:** 3.0
**Last Updated:** December 2024
**Purpose:** Co-branded property marketing pages for Loan Officers and Realtors

---

## Executive Summary

The Property Site Generator is a HubSpot-native tool that allows loan officers to create professional property listing pages. It uses HubSpot's built-in infrastructure (HubDB, Serverless Functions, CMS) with no external dependencies or third-party services.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HubSpot CMS Hub                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐                  │
│   │  Generator Form │────▶│   Serverless    │                  │
│   │    (Module)     │     │   Functions     │                  │
│   └─────────────────┘     └────────┬────────┘                  │
│                                    │                            │
│                                    ▼                            │
│   ┌─────────────────┐     ┌─────────────────┐                  │
│   │  Dynamic Pages  │◀────│     HubDB       │                  │
│   │   (Template)    │     │   (Database)    │                  │
│   └─────────────────┘     └─────────────────┘                  │
│                                    │                            │
│                                    ▼                            │
│                          ┌─────────────────┐                   │
│                          │  File Manager   │                   │
│                          │    (Images)     │                   │
│                          └─────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Generator Module (User Interface)
| Attribute | Details |
|-----------|---------|
| **Location** | HubSpot Design Manager > Modules |
| **Technology** | HTML, CSS, Vanilla JavaScript (ES5) |
| **Function** | Form interface for property data entry |
| **External Dependencies** | None |

### 2. Serverless Functions (API Layer)
| Function | Method | Purpose |
|----------|--------|---------|
| `upload-file` | POST | Uploads images to HubSpot File Manager |
| `create-property` | POST | Creates new row in HubDB |
| `list-properties` | GET | Retrieves user's properties from HubDB |
| `delete-property` | DELETE | Removes property row from HubDB |

**Runtime:** Node.js 18.x (HubSpot managed)
**External Calls:** None - only HubSpot APIs

### 3. HubDB Table (Database)
| Attribute | Details |
|-----------|---------|
| **Table Name** | `property_listings` |
| **Row Limit** | 10,000 rows (HubSpot limit) |
| **Access** | Private App Token (server-side only) |

### 4. Dynamic Page Template (Output)
| Attribute | Details |
|-----------|---------|
| **Technology** | HubL (HubSpot templating language) |
| **URL Pattern** | `/properties/{slug}` |
| **Caching** | HubSpot CDN |

---

## Security Assessment

### Authentication & Authorization

| Layer | Method |
|-------|--------|
| **User Access** | HubSpot CMS login required to access generator |
| **API Authentication** | HubSpot Private App Token (server-side only) |
| **Data Isolation** | Users only see their own properties (filtered by email) |
| **Delete Protection** | Ownership verification before deletion |

### Data Flow Security

```
User Browser ──HTTPS──▶ HubSpot CDN ──▶ Serverless Function ──▶ HubDB
                              │
                              └── All traffic encrypted (TLS 1.2+)
```

### What This System Does NOT Do

| Risk | Status |
|------|--------|
| Store passwords | ❌ No - Uses HubSpot authentication |
| Access external APIs | ❌ No - HubSpot APIs only |
| Execute user-provided code | ❌ No - Data only |
| Store payment information | ❌ No - Not applicable |
| Access other HubSpot data | ❌ No - Scoped to specific APIs |
| Run on external servers | ❌ No - HubSpot infrastructure only |

### Private App Scopes Required

| Scope | Purpose |
|-------|---------|
| `cms.files.read_write` | Upload property photos |
| `hubdb` | Read/write property data |

**Note:** These are the minimum required scopes. The Private App cannot access contacts, deals, or other CRM data.

---

## Data Storage

### HubDB Table Schema

| Field | Type | Sensitive? | Purpose |
|-------|------|------------|---------|
| address | Text | No | Property street address |
| city, state, zip | Text | No | Property location |
| price | Number | No | Listing price |
| bedrooms, bathrooms, sqft | Number | No | Property details |
| description | Rich Text | No | Property description |
| photos | Text (JSON) | No | Array of image URLs |
| realtor_name, realtor_email | Text | Low | Realtor contact (public on page) |
| lo_name, lo_email | Text | Low | Loan officer contact (public on page) |
| created_by_email | Text | Low | User tracking for filtering |

### Image Storage

- **Location:** HubSpot File Manager (`/property-generator/` folder)
- **Access:** Public URLs (required for page display)
- **Retention:** Follows HubSpot File Manager policies

---

## Infrastructure

### Hosting
| Component | Host |
|-----------|------|
| Form Module | HubSpot CMS |
| Serverless Functions | HubSpot (AWS Lambda backend) |
| Database | HubSpot HubDB |
| File Storage | HubSpot File Manager |
| CDN | HubSpot (Cloudflare) |

### Reliability
- **Uptime SLA:** Per HubSpot Enterprise agreement
- **Backups:** HubSpot managed
- **Disaster Recovery:** HubSpot managed

### Performance
- **Function Timeout:** 10 seconds max
- **Function Memory:** 128MB
- **CDN Caching:** Automatic for published pages

---

## Compliance Considerations

| Requirement | Status |
|-------------|--------|
| **Data Residency** | HubSpot data centers (US/EU based on portal settings) |
| **GDPR** | Covered under HubSpot DPA |
| **SOC 2** | HubSpot is SOC 2 Type II certified |
| **Data Deletion** | Properties can be deleted via UI or HubDB |

---

## Deployment Process

### Prerequisites
1. HubSpot CMS Hub Professional or Enterprise
2. HubSpot CLI installed
3. Private App created with required scopes

### Deployment Steps
```bash
# 1. Authenticate with HubSpot
hs auth

# 2. Upload module and functions
hs upload hubspot/ theme-folder --portal=PORTAL_ID

# 3. Create HubDB table (via HubSpot UI)
# 4. Add secrets to serverless config
# 5. Create dynamic page template
```

### Rollback
- Modules can be reverted via Design Manager version history
- HubDB data persists independently of code
- No database migrations required

---

## Monitoring & Logging

| What | Where |
|------|-------|
| Function Errors | HubSpot > Settings > Website > Serverless Functions |
| Page Views | HubSpot Analytics |
| API Usage | HubSpot Private App dashboard |

---

## Capacity Planning

| Metric | Limit | Our Expected Usage |
|--------|-------|-------------------|
| HubDB Rows | 10,000 | ~5,000 (500 users × 10 properties avg) |
| File Storage | Per plan | ~50GB (500 users × 100MB avg) |
| Serverless Executions | 1M/month | ~50,000/month estimated |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HubSpot outage | Low | High | N/A - platform dependency |
| Data loss | Very Low | Medium | HubSpot backups; can export HubDB |
| Unauthorized access | Very Low | Medium | HubSpot auth + ownership checks |
| Performance issues | Low | Low | CDN caching; async operations |
| Hitting row limits | Low | Medium | Monitor usage; archive old listings |

---

## Support & Maintenance

| Task | Frequency | Owner |
|------|-----------|-------|
| Monitor error logs | Weekly | Admin |
| Review storage usage | Monthly | Admin |
| Security updates | As needed | HubSpot (platform) |
| Feature updates | As requested | Development |

---

## Approval Checklist

- [ ] Security team review
- [ ] HubSpot admin approval
- [ ] Private App scopes approved
- [ ] Test deployment in sandbox/staging
- [ ] User training documentation
- [ ] Rollback plan confirmed

---

## Questions?

Contact: [Your IT/Development Team Contact]
