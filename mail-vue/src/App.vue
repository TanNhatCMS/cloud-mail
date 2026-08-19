<template>
  <el-config-provider :locale="localeEl">
    <router-view />
  </el-config-provider>
</template>
<script setup>
import { useI18n } from "vue-i18n";
import { watch, computed } from "vue";
import {useSettingStore} from "@/store/setting.js";
const settingStore = useSettingStore()
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import viVn from 'element-plus/es/locale/lang/vi';
import enUs from 'element-plus/es/locale/lang/en';
import('@/icons/index.js')
const { locale } = useI18n()
locale.value = settingStore.lang
watch(() => settingStore.lang, () => locale.value = settingStore.lang)

const localeEl = computed(() => {
  if (settingStore.lang === 'zh') return zhCn
  if (settingStore.lang === 'vi') return viVn
  return enUs
})
</script>
