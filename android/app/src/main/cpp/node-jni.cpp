/*
 * Peak Android — پل JNI برای اجرای کامل Node.js داخل فرآیند اپ (عین نسخهٔ PC).
 *
 * همان کاری را می‌کند که در ویندوز: node node_modules/next/dist/bin/next start
 * یعنی فراخوانی node::Start از libnode (nodejs-mobile 18.20.4 — MODULE_VERSION 108).
 */
#include <jni.h>
#include <node.h>

#include <unistd.h>
#include <cstdlib>
#include <string>
#include <vector>

#include <android/log.h>

#define LOG_TAG "PeakNode"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_peak_app_NodeService_startNodeWithArguments(
        JNIEnv *env, jobject /*thiz*/, jobjectArray jArgs, jstring jWorkdir) {
    // پوشهٔ کاری = filesDir/app — همان‌جایی که assets (next + .next) نصب شده
    const char *workdir = env->GetStringUTFChars(jWorkdir, nullptr);
    if (chdir(workdir) != 0) {
        LOGE("chdir failed: %s", workdir);
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
    std::vector<std::string> storage;
    storage.reserve(static_cast<size_t>(argc));
    for (jsize i = 0; i < argc; i++) {
        auto jArg = (jstring) env->GetObjectArrayElement(jArgs, i);
        const char *raw = env->GetStringUTFChars(jArg, nullptr);
        storage.emplace_back(raw);
        env->ReleaseStringUTFChars(jArg, raw);
        env->DeleteLocalRef(jArg);
    }
    std::vector<char *> argv;
    argv.reserve(storage.size() + 1);
    for (auto &s : storage) {
        argv.push_back(s.data());
    }
    argv.push_back(nullptr);

    LOGI("node::Start with %d args (first: %s)", argc, argv[0]);
    // همان entry-point رسمی Node — مسدود می‌شود تا پروسهٔ node بسته شود
    int rc = node::Start(argc, argv.data());
    LOGI("node::Start exited with %d", rc);
    return rc;
}
