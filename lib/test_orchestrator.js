import OpenAI from 'openai';
import StateManager from './state_manager.js';

class TestOrchestrator {
    constructor(config) {
        this.stateManager = new StateManager();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.config = config;
        
        // Register state change observers
        this.stateManager.addObserver('stateChanged', this.handleStateChange.bind(this));
        this.stateManager.addObserver('error', this.handleError.bind(this));
    }

    async handleStateChange({ prevState, newState, action }) {
        // Analyze state changes and make decisions
        if (action === 'RECORD_ERROR') {
            const analysis = await this.analyzeError(newState.artifacts.errors[newState.artifacts.errors.length - 1]);
            await this.stateManager.transition('ADD_ANALYSIS', { content: analysis });
        }
    }

    async handleError({ error, action, state }) {
        console.error(`Error during action ${action}:`, error);
        // Implement recovery strategies
    }

    async analyzeError(error) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{
                    role: "system",
                    content: "You are a web testing expert. Analyze the following error and provide insights."
                }, {
                    role: "user",
                    content: `Analyze this testing error and provide recommendations: ${JSON.stringify(error)}`
                }],
                temperature: 0.7,
                max_tokens: 500
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error analyzing with OpenAI:', error);
            return 'Error analysis failed';
        }
    }

    async runTest(page, testConfig) {
        await this.stateManager.transition('START_TEST');

        try {
            for (const step of testConfig.steps) {
                await this.stateManager.transition('UPDATE_STEP', {
                    step: step.name,
                    status: 'running'
                });

                try {
                    await step.action(page);
                    
                    // Capture screenshot after successful step
                    const screenshot = await page.screenshot();
                    await this.stateManager.transition('CAPTURE_SCREENSHOT', {
                        path: screenshot,
                        step: step.name
                    });

                    await this.stateManager.transition('UPDATE_STEP', {
                        step: step.name,
                        status: 'success'
                    });
                } catch (error) {
                    // Capture screenshot on error
                    const errorScreenshot = await page.screenshot();
                    await this.stateManager.transition('CAPTURE_SCREENSHOT', {
                        path: errorScreenshot,
                        step: step.name
                    });

                    await this.stateManager.transition('RECORD_ERROR', {
                        error: error.message,
                        step: step.name
                    });

                    await this.stateManager.transition('UPDATE_STEP', {
                        step: step.name,
                        status: 'failed'
                    });

                    throw error; // Re-throw to stop test execution
                }
            }

            await this.stateManager.transition('END_TEST', {
                status: 'success'
            });

        } catch (error) {
            await this.stateManager.transition('END_TEST', {
                status: 'failed'
            });
        }

        return {
            state: this.stateManager.exportState()
        };
    }
}

export default TestOrchestrator;
