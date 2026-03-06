// Mock path-alias imports used by the service
jest.mock('src/core/domain/ports/outbound/subpartida.repository', () => ({
  SUBPARTIDA_REPOSITORY: 'SUBPARTIDA_REPOSITORY',
  SubpartidaRepository: class {
    findAll = jest.fn();
    search = jest.fn();
  }
}), { virtual: true });
jest.mock('src/core/domain/ports/outbound/ai.service', () => ({ AIService: class {} }), { virtual: true });
jest.mock('src/core/domain/models/factura', () => ({ Factura: class {} }), { virtual: true });

const { LangChainAIService } = require('./langchain-ai.service');

// Mocks for dependencies
const mockSubpartidas = [
  { id: '1', descripcion: 'Producto A' },
  { id: '2', descripcion: 'Laptops y computadores portátiles' },
];

const mockRepo = {
  findAll: jest.fn().mockResolvedValue(mockSubpartidas),
  search: jest.fn().mockResolvedValue([]),
};

const mockConfig = {
  get: jest.fn().mockReturnValue(undefined),
};

describe('LangChainAIService - normalize problematic Gemini response', () => {
  it('should extract JSON from parts[].text code-fence and return mapped subpartida', async () => {
    const svc = new (LangChainAIService as any)(mockRepo, mockConfig);

    // Simulate the LLM returning a JSON string whose parts[].text contains a code-fenced JSON array
    const llmOutput = JSON.stringify({
      parts: [
        { text: '```json\n[\n  {\n    "id": "2",\n    "razon": "La descripción de esta subpartida, \'Laptops y computadores portátiles\', coincide..."\n  }\n]\n```' }
      ],
      role: 'model'
    });

    svc['model'] = { invoke: async () => llmOutput };

    const results = await svc.buscarSubpartidas('Lenovo Legion Pro 7i – Gaming Laptop', { linea: 'Laptops' });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('2');
    expect(results[0].razon).toContain('Laptops y computadores portátiles');
  });
});
