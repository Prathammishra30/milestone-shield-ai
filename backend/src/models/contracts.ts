/**
 * Trusted Server-Side Contracts & Memberships Store
 *
 * Enforces multi-tenant data isolation and role-based permissions
 * for clients and freelancers.
 */

export type UserRole = 'client' | 'freelancer' | 'admin';

export interface ContractMember {
  userId: string;
  role: UserRole;
  joinedAt: string;
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  totalBudget: number;
  currency: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  clientId: string;
  freelancerId?: string;
  members: ContractMember[];
  createdAt: string;
  updatedAt: string;
}

// Canonical demo contract matching initialMilestones
const contractsStore = new Map<string, Contract>([
  [
    'proj-001',
    {
      id: 'proj-001',
      title: 'E-Commerce Platform Redesign & Implementation',
      description: 'End-to-end modern storefront redesign, checkout optimization, and milestone protection.',
      totalBudget: 12000,
      currency: 'USD',
      status: 'active',
      clientId: 'usr-client-001',
      freelancerId: 'usr-freelancer-001',
      members: [
        {
          userId: 'usr-client-001',
          role: 'client',
          joinedAt: '2026-09-01T00:00:00Z',
        },
        {
          userId: 'usr-freelancer-001',
          role: 'freelancer',
          joinedAt: '2026-09-02T00:00:00Z',
        },
      ],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    },
  ],
  [
    'proj-002',
    {
      id: 'proj-002',
      title: 'Brand Identity & Design System',
      description: 'Complete brand guidelines, design system, and component library.',
      totalBudget: 8500,
      currency: 'USD',
      status: 'active',
      clientId: 'usr-client-002',
      freelancerId: 'usr-freelancer-002',
      members: [
        {
          userId: 'usr-client-002',
          role: 'client',
          joinedAt: '2026-09-05T00:00:00Z',
        },
        {
          userId: 'usr-freelancer-002',
          role: 'freelancer',
          joinedAt: '2026-09-06T00:00:00Z',
        },
      ],
      createdAt: '2026-09-05T00:00:00Z',
      updatedAt: '2026-09-06T00:00:00Z',
    },
  ],
]);

export function getContractById(id: string): Contract | undefined {
  return contractsStore.get(id);
}

export function listContractsForUser(userId: string): Contract[] {
  return Array.from(contractsStore.values()).filter((c) =>
    c.members.some((m) => m.userId === userId)
  );
}

export function getUserMembership(contractId: string, userId: string): ContractMember | undefined {
  const contract = contractsStore.get(contractId);
  if (!contract) return undefined;
  return contract.members.find((m) => m.userId === userId);
}

export function isUserContractMember(contractId: string, userId: string): boolean {
  return getUserMembership(contractId, userId) !== undefined;
}

export function createContract(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Contract {
  const id = `proj-${Date.now()}`;
  const now = new Date().toISOString();
  const contract: Contract = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };
  contractsStore.set(id, contract);
  return contract;
}

export function resetContractsStoreForTests(): void {
  // restore initial 2 contracts
  contractsStore.clear();
  contractsStore.set('proj-001', {
    id: 'proj-001',
    title: 'E-Commerce Platform Redesign & Implementation',
    description: 'End-to-end modern storefront redesign, checkout optimization, and milestone protection.',
    totalBudget: 12000,
    currency: 'USD',
    status: 'active',
    clientId: 'usr-client-001',
    freelancerId: 'usr-freelancer-001',
    members: [
      { userId: 'usr-client-001', role: 'client', joinedAt: '2026-09-01T00:00:00Z' },
      { userId: 'usr-freelancer-001', role: 'freelancer', joinedAt: '2026-09-02T00:00:00Z' },
    ],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
  });
  contractsStore.set('proj-002', {
    id: 'proj-002',
    title: 'Brand Identity & Design System',
    description: 'Complete brand guidelines, design system, and component library.',
    totalBudget: 8500,
    currency: 'USD',
    status: 'active',
    clientId: 'usr-client-002',
    freelancerId: 'usr-freelancer-002',
    members: [
      { userId: 'usr-client-002', role: 'client', joinedAt: '2026-09-05T00:00:00Z' },
      { userId: 'usr-freelancer-002', role: 'freelancer', joinedAt: '2026-09-06T00:00:00Z' },
    ],
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-06T00:00:00Z',
  });
}
