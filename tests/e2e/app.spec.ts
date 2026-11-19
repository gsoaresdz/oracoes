import { expect, test, type Page } from '@playwright/test';

// 2026-11-08 é domingo; 2026-11-09, segunda; 2026-11-07, sábado.
const SUNDAY = new Date('2026-11-08T12:00:00-03:00');
const MONDAY = new Date('2026-11-09T12:00:00-03:00');
const SATURDAY = new Date('2026-11-07T12:00:00-03:00');

async function login(page: Page, date = SUNDAY, { liveClock = false } = {}) {
  // Relógio fixo para escolher o dia; "vivo" quando o teste precisa avançar o tempo.
  if (liveClock) await page.clock.install({ time: date });
  else await page.clock.setFixedTime(date);
  await page.goto('/');
  await page.getByLabel('E-mail').fill('demo@oracoes.local');
  await page.getByLabel('Senha').fill('demo');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('h1')).toBeVisible();
}

const sectionTitles = (page: Page) => page.locator('.day-section h2').allInnerTexts();
const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test('senha errada mostra erro e não entra', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill('demo@oracoes.local');
  await page.getByLabel('Senha').fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
});

test('domingo abre com a Preparação antes da base', async ({ page }) => {
  await login(page, SUNDAY);
  await expect(page.locator('h1')).toHaveText('Domingo');
  const titles = await sectionTitles(page);
  expect(titles[0]).toContain('Preparação para a Santa Missa');
  expect(titles[1]).toContain('Primícias');
  expect(titles[1].toLowerCase()).toContain('base de todos os dias');
  expect(titles[2]).toContain('Primícias de domingo');
  await expect(page.locator('.prayer')).toHaveCount(45);
  await noOverflow(page);
});

test('segunda abre com a base primeiro', async ({ page }) => {
  await login(page, MONDAY);
  await expect(page.locator('h1')).toHaveText('Segunda-feira');
  expect((await sectionTitles(page))[0]).toContain('Primícias');
  await expect(page.locator('.prayer')).toHaveCount(34);
});

test('todos os dias têm as orações certas', async ({ page }) => {
  await login(page);
  const expected = [['Domingo', 45], ['Segunda-feira', 34], ['Terça-feira', 34], ['Quarta-feira', 32], ['Quinta-feira', 30], ['Sexta-feira', 32], ['Sábado', 32]] as const;
  for (const [weekday, [name, count]] of expected.entries()) {
    await page.goto(`/dia/${weekday}`);
    await expect(page.locator('h1')).toHaveText(name);
    await expect(page.locator('.prayer')).toHaveCount(count);
    await expect(page.locator('.day-section').filter({ hasText: 'Base de todos os dias' })).toHaveCount(1);
  }
});

test('cada dia da semana abre sozinho', async ({ page }) => {
  await login(page, SATURDAY);
  await expect(page.locator('h1')).toHaveText('Sábado');
  await expect(page.locator('.prayer')).toHaveCount(32);
  await expect(page.locator('.prayer', { hasText: 'Pela paz da Igreja' })).toHaveCount(1);
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00-03:00'));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Terça-feira');
  await expect(page.locator('.prayer', { hasText: 'Uma Oração Contra a Raiva' })).toHaveCount(1);
});

test('dia excluído mostra só a base e pode ser montado de novo', async ({ page }) => {
  await login(page, SATURDAY);
  await page.getByRole('link', { name: 'Editar este dia' }).click();
  await page.getByRole('button', { name: 'Excluir este dia' }).click();
  await page.getByRole('button', { name: 'Sim, excluir' }).click();
  await expect(page.locator('h1')).toHaveText('Sábado');
  await expect(page.locator('.prayer')).toHaveCount(12);
  await expect(page.getByText('Nada mais cadastrado para sábado.')).toBeVisible();
  await page.getByRole('button', { name: 'Montar este dia' }).click();
  await expect(page.locator('h1')).toHaveText('Editar Sábado');
  await expect(page.getByText('Base de todos os dias')).toBeVisible();
});

test('biblioteca resume o que aparece em todos os dias', async ({ page }) => {
  await login(page);
  await page.goto('/oracoes');
  await expect(page.locator('.eyebrow').first()).toHaveText('82 orações');
  const pills = (title: string) => page.locator('.library li', { hasText: title }).locator('.pill');
  await expect(pills('Pai-nosso')).toHaveText(['Todos os dias']);
  await expect(pills('Fica comigo, Senhor!')).toHaveText(['Todos os dias']);
  await expect(pills('Ato de abandono (Jeremias)')).toHaveText(['Todos os dias']);
  await expect(pills('Uma Oração Contra a Raiva')).toHaveText(['Terça-feira']);
});

test('a oração mostra só o texto em português', async ({ page }) => {
  await login(page);
  const prayer = page.locator('.prayer', { hasText: 'Ave-Maria' });
  await prayer.locator('summary').click();
  const text = await prayer.locator('.prayer-text').innerText();
  expect(text).toContain('Ave, Maria, cheia de graça');
  expect(text).not.toMatch(/gratia plena|Χαῖρε|Sobre a oração|Referências|Roschini/);
});

test('editar uma oração da base muda nos dois dias', async ({ page }) => {
  await login(page);
  await page.goto('/oracoes');
  await page.getByLabel('Buscar orações').fill('movei');
  await page.getByRole('link', { name: /Movei-me/ }).click();
  await page.getByLabel('Texto da oração').fill('Texto novo da base.');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('h1')).toHaveText('Biblioteca');
  for (const path of ['/dia/0', '/dia/1']) {
    await page.goto(path);
    const prayer = page.locator('.prayer', { hasText: 'Movei-me' });
    await prayer.locator('summary').click();
    await expect(prayer.locator('.prayer-text')).toHaveText('Texto novo da base.');
  }
});

test('cadastrar oração e colocá-la em dois dias', async ({ page }) => {
  await login(page);
  await page.goto('/oracoes/nova');
  await page.getByLabel('Título').fill('Oração de teste');
  await page.getByLabel('Texto da oração').fill('Senhor, **ouvi-nos**.');
  const placement = page.locator('.placement-row');
  await expect(placement).toHaveCount(8);
  for (const day of ['Domingo', 'Segunda-feira']) {
    const row = placement.filter({ hasText: day });
    await row.locator('summary').click();
    await row.getByRole('button', { name: 'Noite' }).click();
    await expect(row.locator('.pill')).toHaveText('1 seção');
  }
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('h1')).toHaveText('Biblioteca');
  await expect(page.locator('.library li', { hasText: 'Oração de teste' }).locator('.pill')).toHaveText(['Domingo', 'Segunda-feira']);
  // Ao reabrir, os dias em que ela está já aparecem abertos.
  await page.locator('.library').getByRole('link', { name: /Oração de teste/ }).click();
  await expect(page.locator('.placement-row', { hasText: 'Domingo' }).getByRole('button', { name: 'Noite' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.placement-row', { hasText: 'Terça-feira' }).getByRole('button', { name: 'Noite' })).toBeHidden();
  await page.getByRole('link', { name: 'Cancelar' }).click();
  for (const path of ['/dia/0', '/dia/1']) {
    await page.goto(path);
    const prayer = page.locator('.day-section', { hasText: 'Noite' }).locator('.prayer', { hasText: 'Oração de teste' });
    await prayer.locator('summary').click();
    await expect(prayer.locator('strong')).toHaveText('ouvi-nos');
  }
});

test('título parecido gera aviso e texto vazio é recusado', async ({ page }) => {
  await login(page);
  await page.goto('/oracoes/nova');
  await page.getByLabel('Título').fill('pai nosso');
  await expect(page.getByRole('status')).toContainText('Pai-nosso');
  await page.getByLabel('Título').fill('Outro título');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Informe o texto da oração.');
});

test('rascunho sobrevive a recarregar a página', async ({ page }) => {
  await login(page);
  await page.goto('/oracoes/nova');
  await page.getByLabel('Título').fill('Rascunho importante');
  await page.getByLabel('Texto da oração').fill('Texto digitado');
  await page.reload();
  await expect(page.getByLabel('Título')).toHaveValue('Rascunho importante');
  await expect(page.getByLabel('Texto da oração')).toHaveValue('Texto digitado');
  await expect(page.getByText('Rascunho não salvo recuperado.')).toBeVisible();
});

test('oração em uso não pode ser apagada; sem uso, pode', async ({ page }) => {
  await login(page);
  await page.goto('/oracoes');
  await page.getByLabel('Buscar orações').fill('pai-nosso');
  await page.getByRole('link', { name: /Pai-nosso/ }).click();
  await expect(page.getByText('Para apagar, primeiro remova esta oração de: Base.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apagar oração' })).toHaveCount(0);

  await page.goto('/oracoes/nova');
  await page.getByLabel('Título').fill('Oração descartável');
  await page.getByLabel('Texto da oração').fill('Texto');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.locator('.library').getByRole('link', { name: /Oração descartável/ }).click();
  await page.getByRole('button', { name: 'Apagar oração' }).click();
  await page.getByRole('button', { name: 'Sim, apagar' }).click();
  await expect(page.locator('.library')).not.toContainText('Oração descartável');
});

async function dragTo(page: Page, from: ReturnType<Page['locator']>, to: ReturnType<Page['locator']>) {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 8, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 2, { steps: 2 });
  await page.mouse.up();
}

test.describe('arrastar', () => {
  test.skip(({ isMobile }) => isMobile, 'O mouse do Playwright não simula toque; o teste roda no desktop.');

  test('reordena dentro da seção e a ordem persiste', async ({ page }) => {
    await login(page, MONDAY);
    await page.getByRole('link', { name: 'Editar este dia' }).click();
    const section = page.getByTestId('edit-section').filter({ has: page.locator('input[value="Noite"]') });
    const titles = section.locator('.edit-item-title');
    const before = await titles.allInnerTexts();
    await dragTo(page, section.getByRole('button', { name: `Mover ${before[0]}`, exact: true }), section.getByTestId('edit-item').nth(2));
    await expect(titles.nth(2)).toHaveText(before[0]);
    await page.reload();
    await expect(titles.nth(2)).toHaveText(before[0]);
    await expect(titles).toHaveCount(before.length);
  });

  test('move uma oração para outra seção e a base de lugar', async ({ page }) => {
    await login(page, MONDAY);
    await page.getByRole('link', { name: 'Editar este dia' }).click();
    const sections = page.getByTestId('edit-section');
    const estudos = sections.filter({ has: page.locator('input[value="Estudos"]') });
    const renuncia = sections.filter({ has: page.locator('input[value="Renúncia"]') });
    // Deixa origem e destino longe das bordas da tela, onde a rolagem automática entra em ação.
    await renuncia.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
    await dragTo(page, renuncia.getByRole('button', { name: 'Mover Oferecimento de si', exact: true }), estudos.getByTestId('edit-item').first());
    // Soltar no meio de uma oração pode resultar em antes ou depois dela; o importante é mudar de seção.
    await expect(estudos.locator('.edit-item-title')).toHaveCount(2);
    await expect(estudos.locator('.edit-item-title', { hasText: 'Oferecimento de si' })).toHaveCount(1);
    await expect(renuncia.locator('.edit-item-title')).toHaveCount(2);
    await page.reload();
    await expect(estudos.locator('.edit-item-title', { hasText: 'Oferecimento de si' })).toHaveCount(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    await dragTo(page, page.getByRole('button', { name: 'Mover a base' }), renuncia.locator('.edit-section-head'));
    await expect(sections.nth(1)).toContainText('Base de todos os dias');
    await page.goto('/dia/1');
    expect((await sectionTitles(page))[1]).toContain('Primícias');
  });
});

test('arrastar com toque reordena no celular', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Só faz sentido em tela de toque.');
  await login(page, MONDAY);
  await page.getByRole('link', { name: 'Editar este dia' }).click();
  const section = page.getByTestId('edit-section').filter({ has: page.locator('input[value="Noite"]') });
  const titles = section.locator('.edit-item-title');
  const before = await titles.allInnerTexts();
  const handle = section.getByRole('button', { name: `Mover ${before[0]}`, exact: true });
  await handle.scrollIntoViewIfNeeded();
  const a = (await handle.boundingBox())!;
  const b = (await section.getByTestId('edit-item').nth(2).boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const touch = (type: string, x: number, y: number) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] } as never);
  const x = a.x + a.width / 2;
  const startY = a.y + a.height / 2;
  const endY = b.y + b.height / 2 + 4;
  await touch('touchStart', x, startY);
  for (let i = 1; i <= 12; i++) await touch('touchMove', x, startY + ((endY - startY) * i) / 12);
  await page.waitForTimeout(250);
  await touch('touchEnd', x, endY);
  await expect(titles.nth(2)).toHaveText(before[0]);
  await page.reload();
  await expect(titles.nth(2)).toHaveText(before[0]);
});

test('seções: criar, renomear, adicionar oração, remover e excluir', async ({ page }) => {
  await login(page, MONDAY);
  await page.getByRole('link', { name: 'Editar este dia' }).click();
  await page.getByLabel('Nome da nova seção').fill('Teste');
  await page.getByRole('button', { name: 'Adicionar seção' }).click();
  const section = page.getByTestId('edit-section').last();
  await expect(section.getByLabel('Nome da seção')).toHaveValue('Teste');
  await section.getByLabel('Nome da seção').fill('Renomeada');
  await section.getByLabel('Nome da seção').press('Enter');
  await section.getByRole('button', { name: '+ Adicionar oração' }).click();
  await section.getByLabel('Buscar oração para adicionar').fill('angelus');
  await section.getByRole('button', { name: /Angelus/ }).click();
  await expect(section.locator('.edit-item-title')).toHaveCount(1);

  await page.goto('/dia/1');
  await expect(page.locator('.day-section h2').last()).toHaveText('Renomeada');
  await page.getByRole('link', { name: 'Editar este dia' }).click();
  const again = page.getByTestId('edit-section').last();
  await again.getByRole('button', { name: /^Remover / }).click();
  await expect(again.locator('.edit-item-title')).toHaveCount(0);
  await again.getByRole('button', { name: 'Excluir seção' }).click();
  await again.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('input[value="Renomeada"]')).toHaveCount(0);
  await page.goto('/oracoes');
  await page.getByLabel('Buscar orações').fill('angelus');
  await expect(page.locator('.library li')).toHaveCount(1);
});

test('tema escuro e exportação de backup', async ({ page }) => {
  await login(page);
  await page.locator('.menu summary').click();
  await page.getByRole('button', { name: 'Tema: automático' }).click();
  await page.getByRole('button', { name: 'Tema: claro' }).click();
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect.poll(background).toBe('rgb(13, 18, 33)');
  await page.reload();
  await expect.poll(background).toBe('rgb(13, 18, 33)');
  await noOverflow(page);

  await page.locator('.menu summary').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar backup (JSON)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^oracoes-backup-.*\.json$/);
});

test('sair volta para o login', async ({ page }) => {
  await login(page);
  await page.locator('.menu summary').click();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test.describe('pausa entre orações', () => {
  const prayers = (page: Page) => page.locator('.prayer');

  test('fechar uma oração trava a próxima por 5 segundos, sem abrir sozinha', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    const [first, second, third] = [prayers(page).nth(0), prayers(page).nth(1), prayers(page).nth(2)];
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await first.locator('summary').click();
    await expect(first).not.toHaveAttribute('open');

    await expect(second.locator('.pause-count')).toHaveText('5');
    await expect(second.locator('summary')).toHaveAttribute('aria-disabled', 'true');
    await expect(third.locator('.pause-timer')).toHaveCount(0);
    // Toque e teclado não abrem durante a pausa.
    await second.locator('summary').click({ force: true });
    await second.locator('summary').press('Enter');
    await expect(second).not.toHaveAttribute('open');

    await page.clock.runFor(2000);
    await expect(second.locator('.pause-count')).toHaveText(/^[1-3]$/);
    await page.clock.runFor(3500);
    await expect(second.locator('.pause-timer')).toHaveCount(0);
    await expect(second).not.toHaveAttribute('open');
    await second.locator('summary').click();
    await expect(second).toHaveAttribute('open', '');
    await noOverflow(page);
  });

  test('a oração fechada pode ser reaberta e a pausa passa para a seção seguinte', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    const firstSection = page.locator('.day-section').nth(0);
    const lastOfSection = firstSection.locator('.prayer').last();
    const firstOfNext = page.locator('.day-section').nth(1).locator('.prayer').first();
    await lastOfSection.locator('summary').click();
    await lastOfSection.locator('summary').click();
    await expect(firstOfNext.locator('.pause-timer')).toBeVisible();
    await lastOfSection.locator('summary').click();
    await expect(lastOfSection).toHaveAttribute('open', '');
  });

  test('com todas abertas, fechar uma vela a próxima por 5 segundos', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    await page.getByRole('button', { name: 'Abrir todas' }).click();
    const [first, second] = [prayers(page).nth(0), prayers(page).nth(1)];
    await first.locator('summary').click();
    await expect(first).not.toHaveAttribute('open');

    await expect(second).toHaveAttribute('open', '');
    await expect(second.locator('.pause-count')).toHaveText('5');
    await expect(second.locator('.prayer-content')).toHaveClass(/veiled/);
    // As seguintes também ficam veladas, mas sem o anel.
    await expect(prayers(page).nth(2).locator('.prayer-content')).toHaveClass(/veiled/);
    await expect(prayers(page).last().locator('.prayer-content')).toHaveClass(/veiled/);
    await expect(page.locator('.pause-timer')).toHaveCount(1);
    await expect(first.locator('.pause-timer')).toHaveCount(0);
    // Não dá para pular fechando a próxima durante a pausa.
    await second.locator('summary').click({ force: true });
    await expect(second).toHaveAttribute('open', '');

    await page.clock.runFor(5500);
    await expect(page.locator('.prayer-content.veiled')).toHaveCount(0);
    await expect(second.locator('.pause-timer')).toHaveCount(0);
    await second.locator('summary').click();
    await expect(second).not.toHaveAttribute('open');
    await expect(prayers(page).nth(2).locator('.prayer-content')).toHaveClass(/veiled/);
  });

  test('"Amém, próxima" no fim da oração fecha e inicia a pausa', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    const [first, second] = [prayers(page).nth(0), prayers(page).nth(1)];
    await first.locator('summary').click();
    await first.getByRole('button', { name: 'Amém, próxima' }).click();
    await expect(first).not.toHaveAttribute('open');
    await expect(second.locator('.pause-count')).toHaveText('5');
    await page.clock.runFor(5500);
    await second.locator('summary').click();
    await expect(second.getByRole('button', { name: 'Amém, próxima' })).toBeEnabled();
  });

  test('a última oração do dia mostra só "Amém" e não inicia pausa', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    const last = prayers(page).last();
    await last.locator('summary').click();
    await last.getByRole('button', { name: 'Amém', exact: true }).click();
    await expect(last).not.toHaveAttribute('open');
    await expect(page.locator('.pause-timer')).toHaveCount(0);
  });

  test('recolher todas não inicia a pausa', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    await page.getByRole('button', { name: 'Abrir todas' }).click();
    await page.getByRole('button', { name: 'Recolher todas' }).click();
    await expect(page.locator('.pause-timer')).toHaveCount(0);
  });

  test('pode ser desligada no menu e a escolha fica salva', async ({ page }) => {
    await login(page, MONDAY, { liveClock: true });
    await page.locator('.menu summary').click();
    await page.getByRole('button', { name: 'Pausa entre orações: ligada' }).click();
    await expect(page.getByRole('button', { name: 'Pausa entre orações: desligada' })).toBeVisible();
    await page.reload();
    const [first, second] = [prayers(page).nth(0), prayers(page).nth(1)];
    await first.locator('summary').click();
    await first.locator('summary').click();
    await expect(page.locator('.pause-timer')).toHaveCount(0);
    await second.locator('summary').click();
    await expect(second).toHaveAttribute('open', '');
  });
});
