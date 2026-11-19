/*
 * Peak Android — پل JNI برای اجرای کامل Node.js داخل فرآیند اپ (عین نسخهٔ PC).
 *
 * همان کاری را می‌کند که در ویندوز: node node_modules/next/dist/bin/next start
 * یعنی فراخوانی node::Start از libnode (nodejs-mobile 18.20.4 — MODULE_VERSION 108).
 */
#include <jni.h>
#include <node.h>

#include <unistd.h>
#include <cstdio>
#include <cstring>
#include <pthread.h>
#include <cstdlib>
#include <string>
#include <vector>

#include <android/log.h>

#define LOG_TAG "PeakNode"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

#if defined(__x86_64__)
// The x86_64 emulator build sends Node startup diagnostics to logcat.
static void *logNodeOutput(void *arg) {
    const int fd = *static_cast<int *>(arg);
    char buffer[2048];
    ssize_t length;
    while ((length = read(fd, buffer, sizeof(buffer) - 1)) > 0) {
        buffer[length] = '\0';
        LOGI("%s", buffer);
    }
    close(fd);
    return nullptr;
}

static void enableNodeDiagnostics() {
    static int channel[2];
    if (pipe(channel) != 0) return;
    pthread_t thread;
    if (pthread_create(&thread, nullptr, logNodeOutput, &channel[0]) != 0) {
        close(channel[0]);
        close(channel[1]);
        return;
    }
    pthread_detach(thread);
    dup2(channel[1], STDOUT_FILENO);
    dup2(channel[1], STDERR_FILENO);
    close(channel[1]);
    setvbuf(stdout, nullptr, _IONBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);
}
#endif

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_peak_app_NodeService_startNodeWithArguments(
        JNIEnv *env, jobject /*thiz*/, jobjectArray jArgs, jstring jWorkdir) {
    // پوشهٔ کاری = filesDir/app — همان‌جایی که assets (next + .next) نصب شده
    const char *workdir = env->GetStringUTFChars(jWorkdir, nullptr);
    if (workdir == nullptr) return 1;
    if (chdir(workdir) != 0) {
        LOGE("chdir failed: %s", workdir);
        env->ReleaseStringUTFChars(jWorkdir, workdir);
        return 1;
    }
    // محیط مشابه اجرای node در ترمینال — داده‌ها داخل filesDir می‌مانند
    std::string home(workdir);
    std::string tmp = home + "/tmp";
    setenv("HOME", home.c_str(), 1);
    setenv("TMPDIR", tmp.c_str(), 1);
    setenv("NODE_ENV", "production", 1);
    setenv("NODE_PATH", (home + "/node_modules").c_str(), 1);
    env->ReleaseStringUTFChars(jWorkdir, workdir);

    // تبدیل آرگومان‌های جاوا به argc/argv
    jsize argc = env->GetArrayLength(jArgs);
    if (argc == 0) return 1;
    // libuv's process-title code expects argv strings in a single allocation.
    std::vector<size_t> offsets;
    std::vector<char> storage;
    for (jsize i = 0; i < argc; i++) {
        auto jArg = (jstring) env->GetObjectArrayElement(jArgs, i);
        const char *raw = env->GetStringUTFChars(jArg, nullptr);
        if (raw == nullptr) return 1;
        offsets.push_back(storage.size());
        storage.insert(storage.end(), raw, raw + std::strlen(raw) + 1);
        env->ReleaseStringUTFChars(jArg, raw);
        env->DeleteLocalRef(jArg);
    }
    std::vector<char *> argv;
    argv.reserve(storage.size() + 1);
    for (size_t offset : offsets) {
        argv.push_back(storage.data() + offset);
    }
    argv.push_back(nullptr);

#if defined(__x86_64__)
    enableNodeDiagnostics();
#endif
    LOGI("node::Start with %d args (first: %s)", argc, argv[0]);
    // همان entry-point رسمی Node — مسدود می‌شود تا پروسهٔ node بسته شود
    int rc = node::Start(argc, argv.data());
    LOGI("node::Start exited with %d", rc);
    return rc;
}
