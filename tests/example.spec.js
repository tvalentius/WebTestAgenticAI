import { test, expect } from '@playwright/test';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

test('analyze webpage content with AI', async ({ page }) => {
  // Navigate to a website
  await page.goto('https://example.com');

  // Get page content
  const pageTitle = await page.title();
  const pageContent = await page.textContent('body');

  // Use OpenAI to analyze the content
  const analysis = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a web testing assistant. Analyze the following webpage content and identify potential issues or improvements."
    }, {
      role: "user",
      content: `Page Title: ${pageTitle}\nContent: ${pageContent}`
    }],
  });

  // Log the AI analysis
  console.log('AI Analysis:', analysis.choices[0].message.content);

  // Basic assertions
  await expect(page).toHaveTitle('Example Domain');
  await expect(page.locator('h1')).toBeVisible();
});
