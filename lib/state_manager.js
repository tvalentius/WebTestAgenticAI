class StateManager {
    constructor() {
        this.state = {
            metadata: {
                startTime: null,
                endTime: null,
                status: null
            },
            history: [],
            artifacts: {
                screenshots: [],
                errors: [],
                analysis: []
            }
        };
        this.observers = new Map();
    }

    addObserver(event, callback) {
        if (!this.observers.has(event)) {
            this.observers.set(event, []);
        }
        this.observers.get(event).push(callback);
    }

    notifyObservers(event, data) {
        if (this.observers.has(event)) {
            this.observers.get(event).forEach(callback => callback(data));
        }
    }

    async transition(action, payload = {}) {
        const prevState = JSON.parse(JSON.stringify(this.state));

        try {
            switch (action) {
                case 'START_TEST':
                    this.state.metadata.startTime = new Date().toISOString();
                    this.state.metadata.status = 'running';
                    break;

                case 'END_TEST':
                    this.state.metadata.endTime = new Date().toISOString();
                    this.state.metadata.status = payload.status;
                    break;

                case 'UPDATE_STEP':
                    this.state.history.push({
                        step: payload.step,
                        status: payload.status,
                        timestamp: new Date().toISOString()
                    });
                    break;

                case 'CAPTURE_SCREENSHOT':
                    this.state.artifacts.screenshots.push({
                        path: payload.path,
                        step: payload.step,
                        timestamp: new Date().toISOString()
                    });
                    break;

                case 'RECORD_ERROR':
                    this.state.artifacts.errors.push({
                        error: payload.error,
                        step: payload.step,
                        timestamp: new Date().toISOString()
                    });
                    break;

                case 'ADD_ANALYSIS':
                    this.state.artifacts.analysis.push({
                        content: payload.content,
                        step: payload.step,
                        timestamp: new Date().toISOString()
                    });
                    break;

                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            this.notifyObservers('stateChanged', {
                prevState,
                newState: this.state,
                action
            });

        } catch (error) {
            this.notifyObservers('error', {
                error,
                action,
                state: this.state
            });
            throw error;
        }
    }

    exportState() {
        return JSON.parse(JSON.stringify(this.state));
    }
}

export default StateManager;
