import Fastify, { FastifyInstance } from 'fastify';
import { ApplicationContext } from '../../src/interfaces/application.context';
import { buildApp } from '../../src/app';
import { Logger } from 'pino';

// Mock Config Service
const mockConfig = {
  get: jest.fn().mockImplementation((key) => {
    if (key === 'NODE_ENV') return 'test';
    return 'mock_value';
  }),
  getAll: jest.fn()
};

// Mock Database Service
const mockDb = {
  isHealthy: jest.fn().mockResolvedValue(true),
  incrementCallsAttended: jest.fn().mockResolvedValue(true),
  incrementCallsDeflected: jest.fn().mockResolvedValue(true),
  getMetrics: jest.fn().mockResolvedValue({ calls_attended: 5, calls_deflected: 1, last_updated: new Date() }),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  fatal: jest.fn()
} as unknown as Logger;

const mockContext = {
  config: mockConfig as any,
  logger: mockLogger,
  db: mockDb as any,
} as ApplicationContext;

describe('Agent Server API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(mockContext);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 OK and DB healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('OK');
      expect(json.environment).toBe('test');
      expect(json.components.mongodb).toBe('connected');
    });
  });

  describe('GET /api/metrics', () => {
    it('should return 200 and the correct mocked metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/metrics',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.calls_attended).toBe(5);
      expect(json.calls_deflected).toBe(1);
    });
  });

  describe('POST /incoming-call', () => {
    it('should return valid TwiML and increment calls attended', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/incoming-call',
        headers: {
          host: 'test-host.local'
        },
        payload: {
          CallSid: 'CA1234567890'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/xml');
      const xml = response.payload;
      
      // Ensure TwiML format is correct
      expect(xml).toContain('<Response>');
      expect(xml).toContain('<Connect>');
      // Ensure the websocket URL uses the correct host header
      expect(xml).toContain('<Stream url="wss://test-host.local/media-stream" />');
      
      // Ensure DB metric was incremented
      expect(mockDb.incrementCallsAttended).toHaveBeenCalled();
    });
  });
});
