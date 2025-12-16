# qsys-reflect-http

Unofficial Node.js client for the [Q-SYS Reflect](https://reflect.qsc.com) API with automated browser-based authentication.

## Features

- **Automated Authentication** — Handles the complex Azure AD B2C OAuth flow via Puppeteer
- **Full API Coverage** — Organizations, sites, cores, systems, network configuration
- **Remote Management** — Reboot cores, rename systems, configure network services
- **TypeScript** — Complete type definitions included
- **Simple API** — Clean, promise-based interface

## Write Operations

The primary purpose of this library is to enable **remote management** of Q-SYS systems. These PUT operations allow you to make changes:

| Method | Description |
|--------|-------------|
| `rebootCore(coreId)` | Remotely reboot a Q-SYS Core |
| `renameSystem(systemId, name)` | Rename a system |
| `updateNetworkService(coreId, serviceId, enabled)` | Enable/disable network services (SSH, discovery, etc.) |

```javascript
// Reboot a core
await client.rebootCore(31652);

// Rename a system
await client.renameSystem(24626, 'Conference Room A');

// Enable SSH for remote maintenance
await client.updateNetworkService(31652, 'ssh', { lanA: true, lanB: false });
```

## Installation

```bash
npm install qsys-reflect-http
```

## Quick Start

```javascript
import { authenticate, createClient } from 'qsys-reflect-http';

// Authenticate with your QSC account
const { token } = await authenticate({
  email: 'your-email@example.com',
  password: 'your-password',
});

// Create the API client
const client = createClient(token);

// Start making API calls
const sites = await client.getSites();
console.log(sites);
```

## Authentication

Authentication uses Puppeteer to automate the browser-based QSC login flow. This is necessary because Q-SYS Reflect uses Azure AD B2C which doesn't support simple username/password API authentication.

```typescript
import { authenticate } from 'qsys-reflect-http';

const { token } = await authenticate({
  email: 'your-email@example.com',
  password: 'your-password',
  headless: true,    // Optional: set to false for debugging (default: true)
  timeout: 60000,    // Optional: authentication timeout in ms (default: 60000)
});
```

### Environment Variables

For security, store credentials in environment variables:

```javascript
import 'dotenv/config';
import { authenticate, createClient } from 'qsys-reflect-http';

const { token } = await authenticate({
  email: process.env.REFLECT_EMAIL,
  password: process.env.REFLECT_PASSWORD,
});

const client = createClient(token);
```

### Token Reuse

The token can be reused for multiple API calls. Tokens eventually expire, at which point you'll receive 401 errors and need to re-authenticate.

```javascript
// Authenticate once
const { token } = await authenticate({ email, password });
const client = createClient(token);

// Make many calls with the same client
await client.getSites();
await client.getCores(4052);
await client.getSystem(24626);
// ... all use the same token
```

---

## API Reference

### User & Account

#### `ping()`

Check API connectivity.

```javascript
const response = await client.ping();
```

#### `getProfile()`

Get the authenticated user's profile.

```javascript
const profile = await client.getProfile();
// { id, email, firstName, lastName, ... }
```

#### `getFeatures()`

Get feature flags for the authenticated user.

```javascript
const features = await client.getFeatures();
```

#### `getAlertCount()`

Get count of unread alerts.

```javascript
const { count } = await client.getAlertCount();
```

---

### Organizations & Sites

#### `getOrganizations()`

Get all organizations the user has access to.

```javascript
const orgs = await client.getOrganizations();
// [{ id, name, ... }, ...]
```

#### `getSites()`

Get all sites the user has access to.

```javascript
const sites = await client.getSites();
// [{ id, name, organizationId, ... }, ...]
```

---

### Cores

#### `getCores(siteId)`

Get all cores for a site.

```javascript
const cores = await client.getCores(4052);
// [{ id, name, systems: [...], ... }, ...]
```

#### `getCore(siteId, coreId)`

Get detailed information about a specific core.

```javascript
const core = await client.getCore(4052, 31652);
```

#### `getCoreFeatures(coreId)`

Get feature configuration for a core.

```javascript
const features = await client.getCoreFeatures(31652);
```

#### `getCoreTime(coreId)`

Get time configuration for a core.

```javascript
const timeConfig = await client.getCoreTime(31652);
```

#### `rebootCore(coreId)`

Reboot a core. Returns `true` on success.

```javascript
const success = await client.rebootCore(31652);
// true
```

> **Warning:** This will immediately reboot the core, interrupting any active audio/control sessions.

---

### Network Configuration

#### `getNetworkInfo(coreId)`

Get network configuration (hostname, interfaces, DNS).

```javascript
const network = await client.getNetworkInfo(31652);
// {
//   data: {
//     hostname: 'sea-3829-qdsp-01',
//     interfaces: [
//       { id: 'LAN A', ipAddress: '172.29.125.15', hasLink: true, ... },
//       { id: 'LAN B', ipAddress: '', hasLink: false, ... }
//     ],
//     dnsServers: [...],
//     autoDns: { dnsServers: [...], dnsSearchDomains: [...] }
//   }
// }
```

#### `getNetworkServices(coreId)`

Get network services configuration (discovery, SSH, QRC, etc.).

```javascript
const services = await client.getNetworkServices(31652);
// {
//   data: [
//     { id: 'discovery', enabled: { lanA: true, lanB: false } },
//     { id: 'ssh', enabled: { lanA: false, lanB: false } },
//     { id: 'mdns', enabled: true },
//     ...
//   ]
// }
```

#### `updateNetworkService(coreId, serviceId, enabled)`

Update a single network service. Automatically fetches current state, modifies the target service, and saves.

```javascript
// Enable SSH on LAN A only
await client.updateNetworkService(31652, 'ssh', { lanA: true, lanB: false });

// Enable mDNS (boolean-type service)
await client.updateNetworkService(31652, 'mdns', true);

// Disable discovery on both LANs
await client.updateNetworkService(31652, 'discovery', { lanA: false, lanB: false });
```

**Available service IDs:**
| Service ID | Type | Description |
|------------|------|-------------|
| `discovery` | LAN | Q-SYS Device Discovery |
| `secure` | LAN | Q-SYS Designer Communications (Secure) |
| `coreRedundancy` | LAN | Core Redundancy |
| `peripheralsAudio` | LAN | Audio-enabled Peripherals |
| `peripheralsControl` | LAN | Control Peripherals (TSC) |
| `uci` | LAN | UCI Viewers |
| `qec` | LAN | External Control Protocol (ASCII) |
| `qrc` | LAN | Remote Control Protocol (JSONRPC) |
| `qrcPublic` | LAN | Remote WebSocket Control (BETA) |
| `ssh` | LAN | Secure Maintenance & Support |
| `mdns` | Boolean | mDNS / Bonjour Discovery |
| `hovermon` | Boolean | Hovermon Audio |

---

### Systems

#### `getSystem(systemId)`

Get detailed information about a system.

```javascript
const system = await client.getSystem(24626);
// {
//   id: 24626,
//   name: 'SEA-3829 Classroom',
//   status: { code: 0, name: 'OK', message: 'Running' },
//   core: { id: 31652, name: 'sea-3829-qdsp-01', model: 'Core 8 Flex', ... },
//   revision: { version: 54, ... },
//   ...
// }
```

#### `getAllSystems()`

Get all systems across all sites and cores. Traverses the full hierarchy.

```javascript
const systems = await client.getAllSystems();
// Returns array of all systems the user has access to
```

> **Note:** This makes multiple API calls (sites → cores → systems), so it may take a few seconds for large deployments.

#### `getSystemItems(systemId)`

Get inventory items for a system.

```javascript
const items = await client.getSystemItems(24626);
```

#### `renameSystem(systemId, name)`

Rename a system. Returns `true` on success.

```javascript
const success = await client.renameSystem(24626, 'SEA-3829 Conference Room');
// true
```

---

## TypeScript

Full type definitions are included. Import types as needed:

```typescript
import { 
  authenticate, 
  createClient,
  // Types
  AuthConfig,
  AuthResult,
  ReflectClient,
  UserProfile,
  Organization,
  Site,
  Core,
  CoreFeatures,
  System,
  SystemItem,
  NetworkServiceEnabled,
} from 'qsys-reflect-http';
```

---

## Error Handling

API errors throw `AxiosError` exceptions:

```javascript
try {
  await client.getCore(9999, 9999);
} catch (error) {
  if (error.response?.status === 404) {
    console.log('Core not found');
  } else if (error.response?.status === 401) {
    console.log('Token expired, re-authenticate');
  }
}
```

---

## Examples

### List all cores with their status

```javascript
const sites = await client.getSites();

for (const site of sites) {
  console.log(`\n${site.name}:`);
  const cores = await client.getCores(site.id);
  
  for (const core of cores) {
    console.log(`  - ${core.name} (${core.model})`);
  }
}
```

### Export all systems to JSON

```javascript
import fs from 'fs';

const systems = await client.getAllSystems();
fs.writeFileSync('systems.json', JSON.stringify(systems, null, 2));
console.log(`Exported ${systems.length} systems`);
```

### Bulk enable SSH on all cores

```javascript
const sites = await client.getSites();

for (const site of sites) {
  const cores = await client.getCores(site.id);
  
  for (const core of cores) {
    await client.updateNetworkService(core.id, 'ssh', { lanA: true, lanB: false });
    console.log(`Enabled SSH on ${core.name}`);
  }
}
```

---

## Requirements

- Node.js 18+
- Puppeteer (automatically installs Chromium)

## License

MIT

## Disclaimer

This is an unofficial, community-maintained package. It is not affiliated with, endorsed by, or supported by QSC, LLC. Use at your own risk.

