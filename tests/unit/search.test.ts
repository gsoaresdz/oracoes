import { describe, expect, it } from 'vitest';
import { searchPrayers, similarTitles } from '../../src/lib/search';

const prayers = [
  { title: 'Oferecimento do dia', body: 'Senhor Deus' },
  { title: 'Bênção dos alimentos', body: '**Antes** das refeições' },
  { title: 'Pai-nosso', body: 'santificado seja o vosso nome e a *bênção*' },
];

describe('searchPrayers', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(searchPrayers(prayers, 'BENCAO')[0].title).toBe('Bênção dos alimentos');
    expect(searchPrayers(prayers, 'refeicoes')).toHaveLength(1);
  });
  it('coloca quem casa pelo título antes de quem casa pelo texto', () => {
    expect(searchPrayers(prayers, 'bencao').map((p) => p.title)).toEqual(['Bênção dos alimentos', 'Pai-nosso']);
  });
  it('exige todas as palavras e ignora marcações', () => {
    expect(searchPrayers(prayers, 'antes refeicoes')).toHaveLength(1);
    expect(searchPrayers(prayers, 'antes pai')).toHaveLength(0);
  });
  it('sem busca devolve tudo', () => {
    expect(searchPrayers(prayers, '  ')).toHaveLength(3);
  });
});

describe('similarTitles', () => {
  it('avisa sobre títulos iguais, contidos ou quase iguais', () => {
    expect(similarTitles(prayers, 'pai nosso')).toHaveLength(1);
    expect(similarTitles(prayers, 'Oferecimento')).toHaveLength(1);
    expect(similarTitles(prayers, 'bencao dos alimento')).toHaveLength(1);
  });
  it('não avisa em títulos diferentes ou muito curtos', () => {
    expect(similarTitles(prayers, 'Salve Rainha')).toHaveLength(0);
    expect(similarTitles(prayers, 'pa')).toHaveLength(0);
  });
});
