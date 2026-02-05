import { Test, TestingModule } from '@nestjs/testing';
import { BuscarSubpartidasUseCase } from './buscar-subpartidas.usecase';
import { AIService, AI_SERVICE } from '../../../domain/ports/outbound/ai.service';

describe('BuscarSubpartidasUseCase', () => {
  let useCase: BuscarSubpartidasUseCase;
  let aiService: AIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuscarSubpartidasUseCase,
        {
          provide: AI_SERVICE,
          useValue: {
            buscarSubpartidas: jest.fn().mockResolvedValue([{ codigo: '123', descripcion: 'test' }]),
          },
        },
      ],
    }).compile();

    useCase = module.get<BuscarSubpartidasUseCase>(BuscarSubpartidasUseCase);
    aiService = module.get<AIService>(AI_SERVICE);
  });

  it('debe llamar al servicio de IA con el término correcto', async () => {
    const results = await useCase.execute('laptop');
    expect(aiService.buscarSubpartidas).toHaveBeenCalledWith('laptop', { linea: undefined });
    expect(results).toHaveLength(1);
    expect(results[0].codigo).toBe('123');
  });
});
