import { Test, TestingModule } from '@nestjs/testing';
import { BuscarSubpartidasDesdePdfUseCase } from './buscar-subpartidas-desde-pdf.usecase';
import { AIService, AI_SERVICE } from '../../../domain/ports/outbound/ai.service';

describe('BuscarSubpartidasDesdePdfUseCase', () => {
  let useCase: BuscarSubpartidasDesdePdfUseCase;
  let aiService: AIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuscarSubpartidasDesdePdfUseCase,
        {
          provide: AI_SERVICE,
          useValue: {
            extraerDatosFactura: jest.fn().mockResolvedValue({
              productos: [
                { descripcion: 'laptop', cantidad: 1 },
                { descripcion: 'refrigerador', cantidad: 2 }
              ]
            }),
            buscarSubpartidas: jest.fn().mockImplementation((desc) => {
              if (desc === 'laptop') return Promise.resolve([{ codigo: '8471.30.00.00' }]);
              if (desc === 'refrigerador') return Promise.resolve([{ codigo: '8418.10.00.00' }]);
              return Promise.resolve([]);
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get<BuscarSubpartidasDesdePdfUseCase>(BuscarSubpartidasDesdePdfUseCase);
    aiService = module.get<AIService>(AI_SERVICE);
  });

  it('debe extraer productos del PDF y buscar subpartidas para cada uno', async () => {
    const buffer = Buffer.from('fake pdf content');
    const results = await useCase.execute(buffer, 'application/pdf');

    expect(aiService.extraerDatosFactura).toHaveBeenCalledWith(buffer, 'application/pdf');
    expect(aiService.buscarSubpartidas).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results[0].producto).toBe('laptop');
    expect(results[0].sugerencias[0].codigo).toBe('8471.30.00.00');
    expect(results[1].producto).toBe('refrigerador');
    expect(results[1].sugerencias[0].codigo).toBe('8418.10.00.00');
  });
});
