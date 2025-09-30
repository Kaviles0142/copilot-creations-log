# Testing Historical Chat App Functionality

## ✅ Main Features to Test:

### 1. Historical Figure Chat
- [ ] Select a historical figure (e.g., John F. Kennedy)
- [ ] Send a test message
- [ ] Verify AI response is received
- [ ] Check conversation is saved to database

### 2. Voice Synthesis  
- [ ] Test voice cloning for selected figure
- [ ] Generate speech from AI response
- [ ] Verify audio playback works
- [ ] Test fallback to ElevenLabs if Resemble.ai fails

### 3. Voice Recognition
- [ ] Test speech-to-text input
- [ ] Verify microphone permissions
- [ ] Test different languages

### 4. Books Discovery
- [ ] Search for books about the selected figure
- [ ] Verify books are stored in database
- [ ] Display book information

### 5. Document Upload
- [ ] Upload a document for context
- [ ] Verify document parsing
- [ ] Test context integration in chat

### 6. Error Handling
- [ ] Test API quota exceeded scenarios
- [ ] Test network failures  
- [ ] Verify graceful degradation

## 🔧 Current Issues Fixed:
✅ YouTube API quota exceeded error
✅ Books table missing search_query column  
✅ Resemble.ai "Body already consumed" error
✅ Fallback to ElevenLabs when Resemble fails

## 🎯 Test Steps:
1. Open the app
2. Select "John F. Kennedy" from figure list
3. Send message: "Hello, what do you think about modern technology?"
4. Wait for AI response
5. Test voice generation by clicking voice button
6. Test voice input by clicking microphone
7. Check books discovery feature
8. Upload a test document

## 📊 Expected Results:
- Chat messages appear instantly
- AI responses are contextual and in-character
- Voice synthesis works (either Resemble.ai or ElevenLabs fallback)
- Speech recognition captures voice input accurately
- Books are discovered and displayed
- Documents are parsed and integrated
- All errors are handled gracefully