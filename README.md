# JavaScript SDK for the PullString Web API

## Overview

This package provides a module to access the PullString Web API.

The PullString Web API lets you add text or audio conversational capabilities to your apps, based upon content that you
write in the PullString Author environment and publish to the PullString Platform.

## Library

The JavaScript SDK is written in ES6 and uses [Babel](http://babeljs.io/) and [Webpack](https://webpack.github.io/) to
generate a library for the browser. While the SDK itself has no dependencies, [Node JS](https://nodejs.org/en/) is required to build the SDK and run the unit tests. After ensuring [Node JS](https://nodejs.org/en/) is installed, run the following command to install the necessary build dependencies.

```
npm run init
```

Then, run the following command to build the library and run unit tests.

```
npm run build
```

The build output can be found at `dist/pullstring.min.js`. You can also run
the tests on their own.

```
npm run test
```
## Quickstart

Below is a barebones example of starting a conversation with the PullString Web API.  It will print the inital content under
the default Activity for your Project. The code assumes you have defined `MY_API_KEY` and `MY_PROJECT_ID` string with
the appropriate IDs.  You can find these in the settings for your project in your account on **pullstring.com**.
We've included the API key and Project ID for the example **Rock, Paper, Scissors** chatbot.

```js
var PS = pullstring;

const MY_API_KEY = '9fd2a189-3d57-4c02-8a55-5f0159bff2cf';
const MY_PROJECT_ID = 'e50b56df-95b7-4fa1-9061-83a7a9bea372';

var request = new PS.Request({
    apiKey: MY_API_KEY,
});

var conversation = new PS.Conversation();

conversation.onResponse = function(response) {
    for (var output of response.outputs) {
        console.log(output.text);
    }
};

conversation.start(MY_PROJECT_ID, request);

// > 'Do you want to play Rock, Paper, Scissors?'
```

In the `examples` directory are two simple examples demonstrating how to use the SDK to hold conversations.
The `chat-text.html` demo is text-base chat client that connects to the **Rock, Paper, Scissors** chatbot using the
above API key and Project ID. The second example, `chat-speech.html`, uses the Web API's speech recognition abilities
with the same bot. If you swith to a project containing audio files in the responses, that audio will play as well. Note
that not all browsers support recording audio.

## Documentation

Documentation for this SDK can be found in [`docs/PullStringSDK.md`](docs/PullStringSDK.md). In addition, the PullString Web API specification can be
found at:

> http://docs.pullstring.com/docs/api

For more information about the PullString Platform, refer to:

> http://pullstring.com

## Developing

To kick off a non-uglified, continuously updating development build:

```
npm run dev
```

This will create `dist/pullstring.js`

To also run unit tests that are applied whenever changes are detected:

```
npm run dev-and-test
```

If you only want to run unit tests on the development build:

```
npm run test-dev
```
