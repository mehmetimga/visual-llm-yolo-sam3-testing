#mobile command
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing && \
PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$HOME/.npm-global/bin:$HOME/flutter/bin:/Library/Apple/usr/bin" \
node test-appium-login.mjs 2>&1




# Make sure Appium is running with clean PATH first
pkill -f appium
env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$HOME/.npm-global/bin" \
  appium --port 4723 &

# Run tests
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing
pnpm test -- --spec specs/flutter_full.feature --platform flutter --real --vgs