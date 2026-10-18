# Peak Android — پل JNI به رانتایم Node (nodejs-mobile)
#
# libnode.so و هدرها توسط scripts/prepare-android-assets.mjs از بستهٔ npm
# nodejs-mobile-react-native@18.20.4 در android/vendor/libnode قرار می‌گیرند
# (در Git کامیت نمی‌شوند — حجم‌شان ~۶۲ مگابایت است).
cmake_minimum_required(VERSION 3.22.1)
project(peak-node CXX)

set(VENDOR ${CMAKE_CURRENT_SOURCE_DIR}/../../../../../vendor/libnode)

add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES
    IMPORTED_LOCATION ${VENDOR}/bin/${ANDROID_ABI}/libnode.so)

add_library(peaknode SHARED node-jni.cpp)

target_include_directories(peaknode PRIVATE ${VENDOR}/include/node)

find_library(log-lib log)

target_link_libraries(peaknode node ${log-lib})
