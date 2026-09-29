import { initTabs } from './core/tabs.js';
import { init as initProjectManager } from './core/projectManager.js';
import { init as initOverview } from './overview/overview.js';
import { init as initStoryboard } from './storyboard/storyboard.js';
import { init as initWorkflow } from './workflow/workflow.js';
import { loadProjects } from './core/storage.js';
import { init as initProjectTransfer } from './core/projectTransfer.js';
import { init as initProjectFiles } from './files/projectFiles.js';
import { init as initUiPreferences } from './core/uiPreferences.js';
import { init as initUpdateManager } from './core/updateManager.js';
import { init as initCouncil } from './council/council.js';
import { init as initTts } from './tts/tts.js';
import { init as initBgm } from './bgm/bgm.js';

document.addEventListener('DOMContentLoaded', () => {
  try { initBgm(); } catch (error) { console.error('BGM 초기화 실패:', error); }
  try {
    const projects = loadProjects();
    if (Array.isArray(projects)) {
      console.info('저장된 프로젝트를 로드했습니다.', projects.length);
    }
  } catch (error) {
    console.error('프로젝트 로드 실패:', error);
  }

  try {
    initProjectManager();
  } catch (error) {
    console.error('프로젝트 관리자 초기화 실패:', error);
  }

  try {
    initTabs();
  } catch (error) {
    console.error('탭 초기화 실패:', error);
  }

  try {
    initOverview();
  } catch (error) {
    console.error('개요 초기화 실패:', error);
  }

  try {
    initCouncil();
  } catch (error) {
    console.error('임원진 회의실 초기화 실패:', error);
  }

  try {
    initUiPreferences();
  } catch (error) {
    console.error('화면 설정 초기화 실패:', error);
  }

  try {
    initUpdateManager();
  } catch (error) {
    console.error('업데이트 기능 초기화 실패:', error);
  }

  try {
    initStoryboard();
  } catch (error) {
    console.error('스토리보드 초기화 실패:', error);
  }

  try {
    initWorkflow();
  } catch (error) {
    console.error('워크플로우 초기화 실패:', error);
  }

  try {
    initTts();
  } catch (error) {
    console.error('TTS 초기화 실패:', error);
  }

  try {
    initProjectTransfer();
  } catch (error) {
    console.error('프로젝트 백업 기능 초기화 실패:', error);
  }

  try {
    initProjectFiles();
  } catch (error) {
    console.error('프로젝트 파일 기능 초기화 실패:', error);
  }

  console.info('앱 기본 구조가 로드되었습니다.');
});
