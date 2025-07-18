This endpoint allows you to generate and stream TTS audio directly for real-time playback. It does not support narration and will generate an audio stream, not a file. It also does not support the RVC pipeline.

Only TTS engines that can support streaming can stream audio e.g. Coqui XTTS supports streaming.
Endpoint Details

    URL: http://{ipaddress}:{port}/api/tts-generate-streaming
    Method: POST
    Content-Type: application/x-www-form-urlencoded

Request Parameters
Parameter 	Type 	Description
text 	string 	The text to convert to speech.
voice 	string 	The voice type to use.
language 	string 	The language for the TTS.
output_file 	string 	The name of the output file.
Example Request

curl -X POST "http://127.0.0.1:7851/api/tts-generate-streaming" \
     -d "text=Here is some text" \
     -d "voice=female_01.wav" \
     -d "language=en" \
     -d "output_file=stream_output.wav"

Response

The endpoint returns a StreamingResponse for the audio stream.

The API also returns a JSON object with the following property:
Property 	Description
output_file_path 	The name of the output file.

Example response:

{
    "output_file_path": "stream_output.wav"
}

JavaScript Example for Streaming Playback

Here's an example of how to use the streaming endpoint in JavaScript for real-time audio playback:

const text = "Here is some text";
const voice = "female_01.wav";
const language = "en";
const outputFile = "stream_output.wav";
const encodedText = encodeURIComponent(text);
const streamingUrl = `http://localhost:7851/api/tts-generate-streaming?text=${encodedText}&voice=${voice}&language=${language}&output_file=${outputFile}`;
const audioElement = new Audio(streamingUrl);
audioElement.play();

Additional Notes

    No Narration Support: This endpoint does not support the narrator function available in the standard TTS generation endpoint.

    No RVC Pipeline: The streaming endpoint does not support the RVC (Real-time Voice Conversion) pipeline.

    Real-time Playback: This endpoint is designed for scenarios where you need immediate audio output, such as interactive applications or real-time text-to-speech conversions.

    Browser Compatibility: The streaming functionality works well with modern web browsers that support audio streaming. Make sure to test compatibility with your target browsers. Firefox may NOT work.

    Error Handling: Implement proper error handling in your client-side code to manage potential issues with the audio stream.

    Bandwidth Considerations: Streaming audio requires a stable network connection. Consider the bandwidth requirements when implementing this in your application, especially for longer text inputs.

    File Output: Although the API returns an output_file_path, the primary purpose of this endpoint is streaming. The file output is a side effect and might not be necessary for all use cases.

    Voice Selection: Ensure that the voice you specify in the request is available in your AllTalk configuration. Using an unavailable voice may result in an error or default voice selection.

    Language Support: The language support for streaming TTS generation is the same as the standard TTS generation. Refer to the supported languages list in the standard TTS generation documentation.
