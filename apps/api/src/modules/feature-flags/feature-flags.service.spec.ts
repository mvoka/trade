import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      featureFlag: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockRedis = {
      getJson: vi.fn(),
      setJson: vi.fn(),
      delPattern: vi.fn(),
    };

    // Directly instantiate the service with mocks
    service = new FeatureFlagsService(mockPrisma, mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when flag is enabled', async () => {
      mockRedis.getJson.mockResolvedValue({ key: 'TEST_FLAG', enabled: true });

      const result = await service.isEnabled('TEST_FLAG');

      expect(result).toBe(true);
    });

    it('should return false when flag is disabled', async () => {
      mockRedis.getJson.mockResolvedValue({ key: 'TEST_FLAG', enabled: false });

      const result = await service.isEnabled('TEST_FLAG');

      expect(result).toBe(false);
    });

    it('should return false when flag does not exist', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);

      const result = await service.isEnabled('NONEXISTENT_FLAG');

      expect(result).toBe(false);
    });
  });

  describe('getFlag', () => {
    it('should return cached flag value', async () => {
      const cachedFlag = {
        key: 'DISPATCH_ENABLED',
        enabled: true,
        resolvedScopeType: 'GLOBAL',
      };
      mockRedis.getJson.mockResolvedValue(cachedFlag);

      const result = await service.getFlag('DISPATCH_ENABLED');

      expect(result).toEqual(cachedFlag);
      expect(mockPrisma.featureFlag.findMany).not.toHaveBeenCalled();
    });

    it('should resolve from database and cache when not in cache', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'DISPATCH_ENABLED',
          enabled: true,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
      ]);

      const result = await service.getFlag('DISPATCH_ENABLED');

      expect(result).toEqual({
        key: 'DISPATCH_ENABLED',
        enabled: true,
        resolvedScopeType: 'GLOBAL',
      });
      expect(mockRedis.setJson).toHaveBeenCalled();
    });

    it('should resolve most specific scope (SERVICE_CATEGORY over GLOBAL)', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'BOOKING_ENABLED',
          enabled: false,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
        {
          key: 'BOOKING_ENABLED',
          enabled: true,
          scopeType: 'SERVICE_CATEGORY',
          regionId: null,
          orgId: null,
          serviceCategoryId: 'electrical',
        },
      ]);

      const result = await service.getFlag('BOOKING_ENABLED', {
        serviceCategoryId: 'electrical',
      });

      expect(result?.enabled).toBe(true);
      expect(result?.resolvedScopeType).toBe('SERVICE_CATEGORY');
    });

    it('should resolve REGION over GLOBAL when REGION matches', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'PHONE_AGENT_ENABLED',
          enabled: false,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
        {
          key: 'PHONE_AGENT_ENABLED',
          enabled: true,
          scopeType: 'REGION',
          regionId: 'york-region',
          orgId: null,
          serviceCategoryId: null,
        },
      ]);

      const result = await service.getFlag('PHONE_AGENT_ENABLED', {
        regionId: 'york-region',
      });

      expect(result?.enabled).toBe(true);
      expect(result?.resolvedScopeType).toBe('REGION');
    });

    it('should fall back to GLOBAL when specific scope does not match', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'PHONE_AGENT_ENABLED',
          enabled: true,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
        {
          key: 'PHONE_AGENT_ENABLED',
          enabled: false,
          scopeType: 'REGION',
          regionId: 'other-region',
          orgId: null,
          serviceCategoryId: null,
        },
      ]);

      const result = await service.getFlag('PHONE_AGENT_ENABLED', {
        regionId: 'york-region',
      });

      expect(result?.enabled).toBe(true);
      expect(result?.resolvedScopeType).toBe('GLOBAL');
    });
  });

  describe('getAllFlags', () => {
    it('should return all flags sorted by key and scope', async () => {
      const mockFlags = [
        {
          id: '1',
          key: 'BOOKING_ENABLED',
          description: 'Enable booking',
          enabled: true,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          key: 'DISPATCH_ENABLED',
          description: 'Enable dispatch',
          enabled: true,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.featureFlag.findMany.mockResolvedValue(mockFlags);

      const result = await service.getAllFlags();

      expect(result).toHaveLength(2);
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: [{ key: 'asc' }, { scopeType: 'asc' }],
      });
    });
  });

  describe('createFlag', () => {
    it('should create a GLOBAL flag successfully', async () => {
      const createDto = {
        key: 'NEW_FEATURE',
        description: 'A new feature flag',
        enabled: false,
        scopeType: 'GLOBAL' as const,
      };

      const createdFlag = {
        id: 'flag-123',
        ...createDto,
        regionId: null,
        orgId: null,
        serviceCategoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
      mockPrisma.featureFlag.create.mockResolvedValue(createdFlag);

      const result = await service.createFlag(createDto, 'admin-123');

      expect(result.key).toBe('NEW_FEATURE');
      expect(result.enabled).toBe(false);
      expect(mockRedis.delPattern).toHaveBeenCalled();
    });

    it('should create a REGION-scoped flag', async () => {
      const createDto = {
        key: 'REGIONAL_FEATURE',
        description: 'A regional feature flag',
        enabled: true,
        scopeType: 'REGION' as const,
        regionId: 'york-region',
      };

      const createdFlag = {
        id: 'flag-123',
        ...createDto,
        orgId: null,
        serviceCategoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
      mockPrisma.featureFlag.create.mockResolvedValue(createdFlag);

      const result = await service.createFlag(createDto);

      expect(result.key).toBe('REGIONAL_FEATURE');
      expect(result.regionId).toBe('york-region');
    });

    it('should throw ConflictException if flag already exists for scope', async () => {
      const createDto = {
        key: 'EXISTING_FLAG',
        enabled: true,
        scopeType: 'GLOBAL' as const,
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue({
        id: 'existing-flag',
        key: 'EXISTING_FLAG',
      });

      await expect(service.createFlag(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid GLOBAL scope with regionId', async () => {
      const createDto = {
        key: 'INVALID_FLAG',
        enabled: true,
        scopeType: 'GLOBAL' as const,
        regionId: 'some-region',
      };

      await expect(service.createFlag(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for REGION scope without regionId', async () => {
      const createDto = {
        key: 'INVALID_FLAG',
        enabled: true,
        scopeType: 'REGION' as const,
      };

      await expect(service.createFlag(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for ORG scope without orgId', async () => {
      const createDto = {
        key: 'INVALID_FLAG',
        enabled: true,
        scopeType: 'ORG' as const,
      };

      await expect(service.createFlag(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for SERVICE_CATEGORY scope without serviceCategoryId', async () => {
      const createDto = {
        key: 'INVALID_FLAG',
        enabled: true,
        scopeType: 'SERVICE_CATEGORY' as const,
      };

      await expect(service.createFlag(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateFlag', () => {
    it('should update flag successfully', async () => {
      const existingFlag = {
        id: 'flag-123',
        key: 'TEST_FLAG',
        description: 'Original description',
        enabled: false,
        scopeType: 'GLOBAL',
        regionId: null,
        orgId: null,
        serviceCategoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedFlag = {
        ...existingFlag,
        enabled: true,
        description: 'Updated description',
      };

      mockPrisma.featureFlag.findUnique.mockResolvedValue(existingFlag);
      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
      mockPrisma.featureFlag.update.mockResolvedValue(updatedFlag);

      const result = await service.updateFlag('flag-123', {
        enabled: true,
        description: 'Updated description',
      });

      expect(result.enabled).toBe(true);
      expect(result.description).toBe('Updated description');
      expect(mockRedis.delPattern).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent flag', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(
        service.updateFlag('nonexistent-id', { enabled: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when changing scope to conflict with existing flag', async () => {
      const existingFlag = {
        id: 'flag-123',
        key: 'TEST_FLAG',
        scopeType: 'GLOBAL',
        regionId: null,
        orgId: null,
        serviceCategoryId: null,
      };

      const conflictingFlag = {
        id: 'flag-456',
        key: 'TEST_FLAG',
        scopeType: 'REGION',
        regionId: 'york-region',
      };

      mockPrisma.featureFlag.findUnique.mockResolvedValue(existingFlag);
      mockPrisma.featureFlag.findFirst.mockResolvedValue(conflictingFlag);

      await expect(
        service.updateFlag('flag-123', {
          scopeType: 'REGION',
          regionId: 'york-region',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteFlag', () => {
    it('should delete flag successfully', async () => {
      const existingFlag = {
        id: 'flag-123',
        key: 'TEST_FLAG',
        description: 'Test flag',
        enabled: true,
        scopeType: 'GLOBAL',
        regionId: null,
        orgId: null,
        serviceCategoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureFlag.findUnique.mockResolvedValue(existingFlag);
      mockPrisma.featureFlag.delete.mockResolvedValue(existingFlag);

      const result = await service.deleteFlag('flag-123');

      expect(result.message).toContain('deleted successfully');
      expect(mockRedis.delPattern).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent flag', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.deleteFlag('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('scope resolution edge cases', () => {
    it('should handle missing scope context gracefully', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'TEST_FLAG',
          enabled: true,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
      ]);

      const result = await service.getFlag('TEST_FLAG');

      expect(result?.enabled).toBe(true);
    });

    it('should resolve ORG scope correctly', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'ORG_FEATURE',
          enabled: false,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
        {
          key: 'ORG_FEATURE',
          enabled: true,
          scopeType: 'ORG',
          regionId: null,
          orgId: 'org-123',
          serviceCategoryId: null,
        },
      ]);

      const result = await service.getFlag('ORG_FEATURE', { orgId: 'org-123' });

      expect(result?.enabled).toBe(true);
      expect(result?.resolvedScopeType).toBe('ORG');
    });

    it('should prefer more specific scopes over less specific ones', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      // All four scopes defined, SERVICE_CATEGORY should win
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'MULTI_SCOPE',
          enabled: false,
          scopeType: 'GLOBAL',
          regionId: null,
          orgId: null,
          serviceCategoryId: null,
        },
        {
          key: 'MULTI_SCOPE',
          enabled: false,
          scopeType: 'REGION',
          regionId: 'region-1',
          orgId: null,
          serviceCategoryId: null,
        },
        {
          key: 'MULTI_SCOPE',
          enabled: false,
          scopeType: 'ORG',
          regionId: null,
          orgId: 'org-1',
          serviceCategoryId: null,
        },
        {
          key: 'MULTI_SCOPE',
          enabled: true,
          scopeType: 'SERVICE_CATEGORY',
          regionId: null,
          orgId: null,
          serviceCategoryId: 'cat-1',
        },
      ]);

      const result = await service.getFlag('MULTI_SCOPE', {
        regionId: 'region-1',
        orgId: 'org-1',
        serviceCategoryId: 'cat-1',
      });

      expect(result?.enabled).toBe(true);
      expect(result?.resolvedScopeType).toBe('SERVICE_CATEGORY');
    });
  });
});
