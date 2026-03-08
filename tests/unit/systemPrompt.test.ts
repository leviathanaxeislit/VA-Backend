import { generateSystemPrompt } from '../../src/services/prompts/systemPrompt';

describe('System Prompt Generator', () => {
  it('should return a string containing the strict limitation instruction', () => {
    const prompt = generateSystemPrompt();
    expect(prompt).toContain('YOUR KNOWLEDGE BASE IS STRICTLY LIMITED TO "WHERE IS MY MONEY?" FAQS.');
  });

  it('should include instructions to invoke the transfer tool', () => {
    const prompt = generateSystemPrompt();
    expect(prompt).toContain('transfer_to_agent');
  });

  it('should not be empty', () => {
    const prompt = generateSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should include instructions to ask for name and ID', () => {
    const prompt = generateSystemPrompt();
    expect(prompt).toContain('ask for their name and transfer ID');
  });
});
