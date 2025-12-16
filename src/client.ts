import axios from 'axios';
import type { AxiosInstance } from 'axios';

const BASE_URL = 'https://reflect.qsc.com';

export interface ReflectClient {
  ping: () => Promise<unknown>;
  getProfile: () => Promise<UserProfile>;
  getOrganizations: () => Promise<Organization[]>;
  getSites: () => Promise<Site[]>;
  getCores: (siteId: number) => Promise<Core[]>;
  getCore: (siteId: number, coreId: number) => Promise<Core>;
  getCoreFeatures: (coreId: number) => Promise<CoreFeatures>;
  getCoreTime: (coreId: number) => Promise<unknown>;
  rebootCore: (coreId: number) => Promise<boolean>;
  getNetworkInfo: (coreId: number) => Promise<unknown>;
  getNetworkServices: (coreId: number) => Promise<unknown>;
  updateNetworkService: (coreId: number, serviceId: string, enabled: NetworkServiceEnabled | boolean) => Promise<boolean>;
  getSystem: (systemId: number) => Promise<System>;
  getAllSystems: () => Promise<System[]>;
  getSystemItems: (systemId: number) => Promise<SystemItem[]>;
  renameSystem: (systemId: number, name: string) => Promise<boolean>;
  getFeatures: () => Promise<unknown>;
  getAlertCount: () => Promise<{ count: number }>;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface Organization {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Site {
  id: string;
  name: string;
  organizationId?: string;
  [key: string]: unknown;
}

export interface Core {
  id: number;
  name: string;
  siteId?: number;
  [key: string]: unknown;
}

export interface CoreFeatures {
  [key: string]: unknown;
}

export interface System {
  id: number;
  name: string;
  coreId?: number;
  [key: string]: unknown;
}

export interface SystemItem {
  id: number;
  name?: string;
  [key: string]: unknown;
}

export interface NetworkServiceEnabled {
  lanA: boolean;
  lanB: boolean;
}

export default function createClient(token: string): ReflectClient {
  const http: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    async ping() {
      const { data } = await http.get('/api/v0/ping');
      return data;
    },

    async getProfile() {
      const { data } = await http.get('/api/v0/users/self/profile');
      return data;
    },

    async getOrganizations() {
      const { data } = await http.get('/api/v0/users/self/organizations', {
        params: { meta: ['permissions', 'limits'] },
      });
      // Unwrap nested data structure
      const items = data?.data ?? data;
      return Array.isArray(items) ? items.map((item: { data?: unknown }) => item.data ?? item) : items;
    },

    async getSites() {
      const { data } = await http.get('/api/v0/users/self/sites', {
        params: { meta: 'permissions' },
      });
      // Unwrap nested data structure
      const items = data?.data ?? data;
      return Array.isArray(items) ? items.map((item: { data?: unknown }) => item.data ?? item) : items;
    },

    async getCores(siteId: number) {
      const { data } = await http.get(`/api/v0/sites/${siteId}/cores`);
      const items = data?.data ?? data;
      return Array.isArray(items) ? items.map((item: { data?: unknown }) => item.data ?? item) : items;
    },

    async getCore(siteId: number, coreId: number) {
      const { data } = await http.get(`/api/v0/sites/${siteId}/cores/${coreId}`, {
        params: { meta: 'permissions' },
      });
      return data?.data ?? data;
    },

    async getCoreFeatures(coreId: number) {
      const { data } = await http.get(`/api/v0/cores/${coreId}/features`);
      return data;
    },

    async getCoreTime(coreId: number) {
      const { data } = await http.get(`/api/v0/cores/${coreId}/config/time`, {
        params: { meta: 'permissions' },
      });
      return data;
    },

    async rebootCore(coreId: number) {
      const response = await http.put(`/api/v0/cores/${coreId}/config/reboot`);
      return response.status >= 200 && response.status < 300;
    },

    async getNetworkInfo(coreId: number) {
      const { data } = await http.get(`/api/v0/cores/${coreId}/config/network`);
      return data;
    },

    async getNetworkServices(coreId: number) {
      const { data } = await http.get(`/api/v0/cores/${coreId}/config/network/services`, {
        params: { meta: ['permissions', 'preset'] },
      });
      return data;
    },

    async updateNetworkService(coreId: number, serviceId: string, enabled: NetworkServiceEnabled | boolean) {
      // Get current services
      const current = await this.getNetworkServices(coreId) as { data?: unknown[] };
      const services = (current?.data ?? current) as { id: string; enabled: unknown }[];
      
      // Find and update the target service
      const service = services.find((s) => s.id === serviceId);
      if (!service) {
        throw new Error(`Service '${serviceId}' not found`);
      }
      service.enabled = enabled;
      
      // Strip to only id and enabled (API rejects extra fields)
      const payload = services.map((s) => ({ id: s.id, enabled: s.enabled }));
      
      // PUT the updated array
      const response = await http.put(`/api/v0/cores/${coreId}/config/network/services`, payload);
      return response.status >= 200 && response.status < 300;
    },

    async getSystem(systemId: number) {
      const { data } = await http.get(`/api/v0/systems/${systemId}`);
      return data?.data ?? data;
    },

    async getAllSystems() {
      const systems: System[] = [];
      const sites = await this.getSites();
      for (const site of sites) {
        const cores = await this.getCores(Number(site.id));
        for (const core of cores) {
          const coreSystems = (core as { systems?: { id: number }[] }).systems ?? [];
          for (const sys of coreSystems) {
            const fullSystem = await this.getSystem(sys.id);
            systems.push(fullSystem);
          }
        }
      }
      return systems;
    },

    async getSystemItems(systemId: number) {
      const { data } = await http.get(`/api/v0/systems/${systemId}/items`, {
        params: { meta: 'permissions', include: 'assetData' },
      });
      const items = data?.data ?? data;
      return Array.isArray(items) ? items.map((item: { data?: unknown }) => item.data ?? item) : items;
    },

    async renameSystem(systemId: number, name: string) {
      const response = await http.put(`/api/v0/systems/${systemId}`, { name });
      return response.status >= 200 && response.status < 300;
    },

    async getFeatures() {
      const { data } = await http.get('/api/v0/users/self/features');
      return data;
    },

    async getAlertCount() {
      const { data } = await http.get('/api/v0/users/self/alerts/groups/count', {
        params: { read: false },
      });
      return data;
    },
  };
}
