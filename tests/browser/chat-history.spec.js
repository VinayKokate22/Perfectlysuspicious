import {test,expect} from '@playwright/test';

test('chat scrolls beyond three messages and preserves the reader position on updates',async({page,request})=>{
  await request.post('http://127.0.0.1:3912/reset');
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
  await page.goto('/');await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Alex');await page.locator('#entry button[type=submit]').click();
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
  for(const word of ['First','Second','Third','Fourth','Fifth']){
    await page.locator('#chat-message').fill(`${word} message with plenty of detail for the room to read`);
    await page.locator('#chat-form button[type=submit]').click();
    await expect(page.locator('.chat-readout')).toContainText(word);
    await request.post('http://127.0.0.1:3912/advance?ms=3000');
  }
  const history=page.locator('.chat-history');
  expect(await history.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  await history.evaluate(node=>node.scrollTop=0);
  await page.locator('#chat-message').fill('Sixth message keeps the earlier conversation available');
  await page.locator('#chat-form button[type=submit]').click();
  await expect(page.locator('.chat-readout')).toContainText('Sixth');
  expect(await history.evaluate(node=>node.scrollTop)).toBeLessThan(2);
  await page.getByRole('button',{name:'Read full chat history',exact:true}).click();
  await expect(page.locator('.chat-file .chat-record')).toHaveCount(6);
  await expect(page.locator('.chat-file .file-pagination')).toBeHidden();
  const content=page.locator('.chat-file .file-content');
  await content.evaluate(node=>node.scrollTop=0);
  await request.post('http://127.0.0.1:3912/advance?ms=8000');
  await expect(page.locator('.chat-file .chat-record')).toHaveCount(6);
  expect(await content.evaluate(node=>node.scrollTop)).toBeLessThan(2);
  await page.reload();await expect(page.locator('.chat-previous')).toHaveCount(5);
});
