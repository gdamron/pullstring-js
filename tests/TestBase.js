var fs = require('fs');

class TestBase {
    constructor(conversation, request, project, version) {
        this.conversation = conversation;
        this.request = request;
        this.project = project;
        this.version = version;
    }

    versionInfo(t) {
        if (this.version.ApiBaseUrl !== 'https://conversation.pullstring.ai/v1/') {
            this.fail(t, 'Base Url is not correct');
        }

        if (this.version.hasFeature(this.version.EFeatures.StreamingAsr)) {
            this.fail(t, 'Streaming Asr should not be enabled');
        }

        this.pass(t);
    }

    badRequest(t) {
        this.conversation.onResponse = response => {
            this.errorShouldMatch('Valid request object missing', response, t);
        };

        if (this.conversation.getConversationId()) {
            this.fail(t, 'Conversation Id should be null at start');
        }

        if (this.conversation.getParticipantId()) {
            this.fail(t, 'Participant Id should be null at start');
        }

        this.conversation.start();
    }

    badProject(t) {
        let step = 0;
        let crap = 'crapcrapcrap';
        let apiKey = this.request.apiKey;

        this.conversation.onResponse = response => {
            switch (step++) {
            case 0:
                this.errorShouldMatch('Invalid project for API key', response, t, true);
                this.request.apiKey = crap;
                this.conversation.start(this.project, this.request);
                break;
            case 1:
                this.request.apiKey = apiKey;
                this.errorShouldMatch('Invalid Authorization Bearer Token', response, t);
                break;
            default: this.fail(t);
            }
        };
        this.conversation.start(crap, this.request);
    }

    badAudio(t) {
        let step = 0;
        let ab1 = this.stringToArrayBuffer('RUFF ');
        let audio1 = new DataView(ab1);

        this.start(response => {
            switch (step++) {
            case 0:
                this.conversation.sendAudio();
                break;
            case 1:
                this.errorShouldMatch('Unsupported format sent to sendAudio.', response, t, true);
                this.conversation.sendAudio(audio1, 1);
                break;
            case 2:
                this.errorShouldMatch('Data is not a WAV file', response, t);
                break;
            case 3:
                this.errorShouldMatch('Audio sent to sendAudio is not a DataView', response, t, true);
                this.conversation.sendAudio(audio1, 0);
                break;
            default: (this.fail(t));
            }
        });
    }

    introduction(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                if (!this.conversation.getConversationId()) {
                    this.fail('Conversation ID not found');
                }
                this.textShouldMatch("Hello. What's your name?", response, t, true);
                this.conversation.sendText('janet');
                break;
            case 1:
                let state = {
                    participantId: this.conversation.getParticipantId()
                };
                this.start(null, state);
                break;
            case 2:
                this.textShouldMatch('Welcome back JANET', response, t);
                break;
            default: this.fail(t);
            }
        });
    }

    introAsr(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                this.textShouldMatch("Hello. What's your name?", response, t, true);
                let file = fs.readFileSync('./res/asrTest.wav');

                if (!file) {
                    t.fail('Unable to open audio file for testing');
                    t.end();
                    return;
                }

                let ab = new ArrayBuffer(file.length);
                let data = new Uint8Array(ab);
                for (let i = 0; i < file.length; i++) {
                    data[i] = file[i];
                }

                let audio = new DataView(ab);

                this.conversation.sendAudio(audio, 1);
                break;
            case 1:
                this.textShouldMatch('Hello Grant', response, t);
                break;
            default: t.fail();
            }
        });
    }

    goToResponse(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                let guid = 'd6701507-61a9-47d9-8300-2e9c6b08dfcd';
                this.conversation.goTo(guid);
                break;
            case 1:
                this.textShouldMatch('Hello ', response, t);
                break;
            default: t.fail();
            }
        });
    }

    entities(t) {
        let step = 0;
        let label = { name: 'NAME', value: 'jill' };

        this.start(response => {
            switch (step++) {
            case 0:
                this.textShouldMatch("Hello. What's your name?", response, t, true);
                this.conversation.sendText('jack');
                break;
            case 1:
                this.conversation.getEntities(['NAME']);
                break;
            case 2:
                this.entityShouldMatch({ name: 'NAME', value: 'jack' }, response, t, true);
                this.conversation.setEntities([label]);
                break;
            case 3:
                this.entityShouldMatch(label, response, t, true);
                this.conversation.getEntities('NAME');
                break;
            case 4:
                this.errorShouldMatch('entities sent to getEntities must be an array', response, t, true);
                this.conversation.setEntities(label);
                break;
            case 5:
                this.errorShouldMatch('entities sent to setEntities must be an array', response, t, true);
                this.conversation.sendText('test web service');
                break;
            case 6:
                this.textShouldMatch(
                    'Web Service Result = INPUT STRING / 42 / 0 / red, green, blue, and purple',
                    response, t, true
                );
                this.conversation.getEntities(['Number2', 'Flag2', 'List2']);
                break;
            case 7:
                let number2 = { name: 'Number2', value: 42 };
                let flag2 = { name: 'Flag2', value: false };
                let list2 = { name: 'List2', value: [ 'red', 'green', 'blue', 'purple' ] };
                this.entityShouldMatch([ flag2, list2, number2 ], response, t);
                break;
            default: t.fail();
            }
        });
    }

    convo(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                this.conversation.sendActivity('wizard');
                break;
            case 1:
                this.conversation.sendText('wizard');
                break;
            case 2:
                this.textShouldMatch('Talk to the dwarf', response, t, true);
                this.conversation.sendText('dwarf');
                break;
            case 3:
                this.textShouldMatch("Here's my axe", response, t, true);
                this.conversation.sendText('dwarf');
                break;
            case 4:
                this.textShouldMatch('You already have my axe', response, t, true);
                this.conversation.sendText('wizard');
                break;
            case 5:
                this.textShouldMatch("Here's my spell", response, t, true);
                this.conversation.sendText('wizard');
                break;
            case 6:
                this.textShouldMatch('You already have my spell', response, t);
                break;
            default: t.fail();
            }
        });
    }

    timedResponse(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                this.conversation.sendActivity('fafa5f56-d6f1-4381-aec8-ce37a68e465f');
                break;
            case 1:
                this.textShouldMatch('Say something', response, t, true);
                this.conversation.checkForTimedResponse();
                break;
            case 2:
                if (response.outputs.length) {
                    t.fail('response was returned');
                    t.end();
                }
                this.sleep(response.timedResponseInterval).then(() => {
                    this.conversation.checkForTimedResponse();
                });
                break;
            case 3:
                this.textShouldMatch("I'm waiting", response, t, true);
                this.conversation.sendText('hit the fallback');
                break;
            case 4:
                this.textShouldMatch(['That was something', 'Yes it was'], response, t);
                break;
            default: t.fail();
            }
        });
    }

    eventsAndBehaviors(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                this.conversation.sendEvent('simple_event');
                break;
            case 1:
                this.behaviorShouldMatch({ behavior: 'simple_action' }, response, t, true);
                this.conversation.sendEvent('event_with_param', { name: 'green' });
                break;
            case 2:
                let behavior1 = {
                    behavior: 'action_with_param',
                    parameters: { name: 'Green' },
                };
                this.textShouldMatch('Green Event Called', response, t, true);
                this.behaviorShouldMatch(behavior1, response, t, true);
                this.conversation.sendEvent('event_with_param', { name: 'red' });
                break;
            case 3:
                let behavior2 = {
                    behavior: 'action_with_param',
                    parameters: { name: 'Red' },
                };
                this.textShouldMatch('Red Event Called', response, t, true);
                this.behaviorShouldMatch(behavior2, response, t);
                break;
            default: t.fail();
            }
        });
    }

    scheduleTimer(t) {
        let step = 0;
        this.start(response => {
            switch (step++) {
            case 0:
                this.conversation.sendActivity('timer');
                break;
            case 1:
                this.textShouldMatch('Starting timer', response, t, true);
                this.conversation.sendText('intervening input');
                break;
            case 2:
                this.textShouldMatch('Ignored', response, t, true);
                this.sleep(response.timedResponseInterval).then(() => {
                    this.conversation.checkForTimedResponse();
                });
                break;
            case 3:
                this.textShouldMatch('Timer fired', response, t);
                break;
            default: t.fail();
            }
        });
    }

    textShouldMatch(expected, response, t, moreTests) {
        let tests = [];
        if (Array.isArray(expected)) {
            tests = expected;
        } else {
            tests.push(expected);
        }

        for (let i in tests) {
            if (response.outputs[i].text !== tests[i]) {
                t.fail(`Text does not match. expected '${tests[i]}', found '${response.outputs[i].text}'`);
                t.end();
                return;
            }
        }

        if (!moreTests) {
            t.pass();
            t.end();
        }
    }

    entityShouldMatch(expected, response, t, moreTests) {
        let tests = [];
        if (Array.isArray(expected)) {
            tests = expected;
        } else {
            tests.push(expected);
        }

        if (!response.entities.length) {
            this.fail(t, 'Response contains no entities');
        }

        for (let i in tests) {
            let entity = response.entities[i];
            let test = tests[i];

            if (entity.name !== test.name) {
                this.fail(t, 'Entity name did not match');
            }

            if (Array.isArray(test.value)) {
                if (!Array.isArray(entity.value)) {
                    this.fail(t, 'Entity value was not an array, as expected');
                }

                for (let i in test.value) {
                    if (test.value[i] !== entity.value[i]) {
                        this.fail(t, 'Value in Array of Entity values did not match');
                    }
                }
            } else if (entity.value !== test.value) {
                this.fail(t, 'Entity value did not match');
            }
        }

        if (!moreTests) {
            this.pass(t);
        }
    }

    behaviorShouldMatch(expected, response, t, moreTests) {
        for (let i in response.outputs) {
            let output = response.outputs[i];
            if (output.type === 'behavior' && output.behavior === expected.behavior) {

                if (expected.parameters) {
                    for (let p in expected.parameters) {
                        if (!output.parameters.hasOwnProperty(p) || output.parameters[p] !== expected.parameters[p]) {
                            t.fail('behavior parameters did not match');
                            t.end();
                            return;
                        }
                    }
                }

                if (!moreTests) {
                    t.pass();
                    t.end();
                }
                return;
            }
        }

        t.fail('matching behavior not found');
        t.end();
    }

    errorShouldMatch(expected, response, t, moreTests) {
        if (response.status.success) {
            t.fail('Request was successful but should have failed');
            t.end();
        }

        if (!response.status.message.startsWith(expected)) {
            t.fail(`Received an unexpected error message: ${response.status.message}`);
            t.end();
        }

        if (!moreTests) {
            t.pass();
            t.end();
        }
    }

    start(callback = null, state = null) {
        this.request.participantId = null;
        this.request.conversationId = null;

        if (state) {
            this.request.participantId = state.participantId;
            this.request.conversationId = state.conversationId;
        }

        if (callback) {
            this.conversation.onResponse = callback;
        }
        this.conversation.start(this.project, this.request);
    }

    sleep(time) {
        return new Promise((resolve) => {
            if (!time) {
                resolve();
            } else {
                setTimeout(resolve, time * 1000.0);
            }
        });
    }

    fail(t, msg) {
        t.fail(msg);
        t.end();
    }

    pass(t) {
        t.pass();
        t.end();
    }

    stringToArrayBuffer(str) {
        let ab = new ArrayBuffer(str.length * 2);
        let arr = new Uint16Array(ab);
        for (let i = 0; i < str.length; i++) {
            arr[i] = str.charCodeAt(i);
        }
        return ab;
    }

}

module.exports = { TestBase };
