/**
 * TripFlow — Internationalization
 */
(function () {
  'use strict';

  const locales = {
    en: {
      meta: {
        title: 'TripFlow — Trip Planner',
        description: 'TripFlow — Plan and share trips with family and friends',
      },
      nav: {
        newTrip: '+ New Trip',
      },
      hero: {
        badge: '✨ Plan together, travel together',
        titleLine1: 'Plan Your Next',
        titleHighlight: 'Adventure',
        titleLine2: 'Together',
        subtitle: 'Create trip itineraries, share with family & friends, and collaborate on the perfect travel plan — all in one place.',
        cta: 'Start Planning',
        demo: 'See How It Works',
      },
      stats: {
        easyValue: 'Easy',
        easyLabel: 'Trip Planning',
        shareValue: 'Share',
        shareLabel: 'With Family',
        dayByDayValue: 'Day-by-Day',
        dayByDayLabel: 'Itineraries',
      },
      features: {
        titlePrefix: 'Everything you need to plan ',
        titleHighlight: 'the perfect trip',
        itineraryTitle: 'Itinerary Builder',
        itineraryDesc: 'Build day-by-day schedules with time slots, locations, and notes.',
        shareTitle: 'Share Instantly',
        shareDesc: 'Invite family with a simple link — no app download required.',
        collaborateTitle: 'Collaborate',
        collaborateDesc: 'Everyone can add events, suggest places, and vote on activities.',
        pinTitle: 'Pin Locations',
        pinDesc: 'Attach restaurants, hotels, and attractions to your schedule.',
        taskTitle: 'Task Assignment',
        taskDesc: 'Divide responsibilities — "Who books the hotel?"',
        mobileTitle: 'Mobile Ready',
        mobileDesc: 'Works perfectly on phones, tablets, and desktops.',
      },
      preview: {
        title: 'Summer Vacation 2026',
        destination: 'Jeju Island, Korea',
        dates: 'Jul 15 — Jul 22',
        days: '8 days',
        event1: '🛫 Arrive at Jeju Airport',
        event2: '🏨 Check-in at Hotel',
        event3: '🍊 Visit Tangerine Farm',
        event4: '🍽️ Dinner — Black Pork BBQ',
      },
      trip: {
        namePlaceholder: 'Trip Name',
        destinationPlaceholder: 'Where are you going?',
        history: '🕒 History',
        shareLink: '🔗 Share Link',
        startLabel: 'Start',
        endLabel: 'End',
        allEvents: 'All Events',
        dayLabel: 'Day {n}',
        duration: '{n} days',
        durationSingular: '{n} day',
        noEvents: 'No events for this day yet',
        noEventsHint: 'Click the button below to add your first event',
        addEvent: 'Add Event',
      },
      event: {
        addTitle: 'Add Event',
        editTitle: 'Edit Event',
        titleLabel: 'Title',
        titlePlaceholder: "What's happening?",
        startTime: 'Start Time',
        endTime: 'End Time',
        location: 'Location',
        locationPlaceholder: 'Where? (optional)',
        notes: 'Notes',
        notesPlaceholder: 'Any details? (optional)',
        cancel: 'Cancel',
        save: 'Save Event',
        duplicateTimeWarn: 'Time overlaps with another event',
      },
      historyModal: {
        title: 'Edit History',
        loading: 'Loading history...',
        loadFailed: 'Failed to load history',
        empty: 'No edit history yet.',
        recover: '↩ Undo / Recover',
        confirmRecover: 'Are you sure you want to revert to this previous state? This will overwrite the current data.',
        recoverSuccess: 'Successfully recovered previous data!',
        recoverFailed: 'Failed to recover: ',
        actions: {
          create_trip: 'Start Trip',
          update_trip: 'Edit Trip',
          add_event: 'Add Event',
          update_event: 'Edit Event',
          delete_event: 'Delete Event',
          recover: 'Recover',
        },
      },
      toast: {
        tripCreated: 'Trip created! Share the link with your family 🎉',
        tripCreateFailed: 'Failed to create trip',
        eventAdded: 'Event added 🎉',
        eventUpdated: 'Event updated ✏️',
        eventSaveFailed: 'Failed to save event: ',
        titleRequired: 'Please enter an event title',
        timeIncomplete: 'Please complete both hours and minutes for the time',
        endBeforeStart: 'End time must be after start time',
        dateEndBeforeStart: 'End date must be after or equal to start date',
        eventDeleted: 'Event deleted',
        eventDeleteFailed: 'Failed to delete event',
        tripDeleted: 'Trip deleted',
        tripDeleteFailed: 'Failed to delete trip',
        linkCopied: 'Link copied to clipboard! 🔗',
      },
      confirm: {
        deleteEvent: 'Delete this event?',
        deleteTrip: 'Delete this entire trip? This cannot be undone.',
      },
      share: {
        copyPrompt: 'Copy this link to share:',
      },
      loading: 'Loading your trip...',
      notFound: {
        title: 'Trip not found',
        desc: 'This link may be invalid or the trip may have been deleted.',
        goHome: 'Go Home',
      },
      footer: {
        brand: '✈️ TripFlow',
        text: 'Plan together, travel together.',
      },
    },

    ko: {
      meta: {
        title: 'TripFlow — 여행 플래너',
        description: 'TripFlow — 가족, 친구와 함께 여행을 계획하고 공유하세요',
      },
      nav: {
        newTrip: '+ 새 여행',
      },
      hero: {
        badge: '✨ 함께 계획하고, 함께 여행하세요',
        titleLine1: '함께 떠날',
        titleHighlight: '여행',
        titleLine2: '을 계획하세요',
        subtitle: '여행 일정을 만들고, 가족과 친구에게 공유하고, 완벽한 여행 계획을 함께 세우세요 — 한 곳에서 모두.',
        cta: '계획 시작하기',
        demo: '사용법 보기',
      },
      stats: {
        easyValue: '간편한',
        easyLabel: '여행 계획',
        shareValue: '공유',
        shareLabel: '가족과 함께',
        dayByDayValue: '일별',
        dayByDayLabel: '일정 관리',
      },
      features: {
        titlePrefix: '완벽한 여행을 계획하는 데 필요한 ',
        titleHighlight: '모든 것',
        itineraryTitle: '일정 만들기',
        itineraryDesc: '시간대, 장소, 메모가 포함된 일별 일정을 만드세요.',
        shareTitle: '즉시 공유',
        shareDesc: '간단한 링크로 가족을 초대하세요 — 앱 다운로드 불필요.',
        collaborateTitle: '협업',
        collaborateDesc: '모두가 일정을 추가하고, 장소를 제안하고, 활동에 투표할 수 있어요.',
        pinTitle: '장소 고정',
        pinDesc: '일정에 레스토랑, 호텔, 관광지를 연결하세요.',
        taskTitle: '할 일 배정',
        taskDesc: '역할을 나누세요 — "누가 호텔을 예약할까?"',
        mobileTitle: '모바일 지원',
        mobileDesc: '스마트폰, 태블릿, 데스크톱에서 완벽하게 작동합니다.',
      },
      preview: {
        title: '2026 여름 휴가',
        destination: '제주도, 한국',
        dates: '7월 15일 — 7월 22일',
        days: '8일',
        event1: '🛫 제주공항 도착',
        event2: '🏨 호텔 체크인',
        event3: '🍊 감귤 농장 방문',
        event4: '🍽️ 저녁 — 흑돼지 구이',
      },
      trip: {
        namePlaceholder: '여행 이름',
        destinationPlaceholder: '어디로 가시나요?',
        history: '🕒 기록',
        shareLink: '🔗 공유 링크',
        startLabel: '시작',
        endLabel: '종료',
        allEvents: '모든 일정',
        dayLabel: '{n}일차',
        duration: '{n}일',
        durationSingular: '{n}일',
        noEvents: '이 날의 일정이 아직 없습니다',
        noEventsHint: '아래 버튼을 클릭하여 첫 일정을 추가하세요',
        addEvent: '일정 추가',
      },
      event: {
        addTitle: '일정 추가',
        editTitle: '일정 수정',
        titleLabel: '제목',
        titlePlaceholder: '무슨 일정인가요?',
        startTime: '시작 시간',
        endTime: '종료 시간',
        location: '장소',
        locationPlaceholder: '어디에서? (선택)',
        notes: '메모',
        notesPlaceholder: '세부 사항이 있나요? (선택)',
        cancel: '취소',
        save: '저장',
        duplicateTimeWarn: '다른 일정과 시간이 겹칩니다',
      },
      historyModal: {
        title: '수정 기록',
        loading: '기록을 불러오는 중...',
        loadFailed: '기록을 불러오지 못했습니다',
        empty: '수정 기록이 없습니다.',
        recover: '↩ 실행 취소',
        confirmRecover: '이전 상태로 되돌리시겠습니까? 현재 데이터를 덮어씁니다.',
        recoverSuccess: '이전 데이터를 복구했습니다!',
        recoverFailed: '복구 실패: ',
        actions: {
          create_trip: '여행 생성',
          update_trip: '여행 수정',
          add_event: '일정 추가',
          update_event: '일정 수정',
          delete_event: '일정 삭제',
          recover: '복구',
        },
      },
      toast: {
        tripCreated: '여행이 생성되었습니다! 가족에게 링크를 공유하세요 🎉',
        tripCreateFailed: '여행 생성에 실패했습니다',
        eventAdded: '일정이 추가되었습니다 🎉',
        eventUpdated: '일정이 수정되었습니다 ✏️',
        eventSaveFailed: '일정 저장 실패: ',
        titleRequired: '일정 제목을 입력해주세요',
        timeIncomplete: '시간의 시와 분을 모두 입력해주세요',
        endBeforeStart: '종료 시간은 시작 시간 이후여야 합니다',
        dateEndBeforeStart: '종료일은 시작일 이후여야 합니다',
        eventDeleted: '일정이 삭제되었습니다',
        eventDeleteFailed: '일정 삭제에 실패했습니다',
        tripDeleted: '여행이 삭제되었습니다',
        tripDeleteFailed: '여행 삭제에 실패했습니다',
        linkCopied: '링크가 클립보드에 복사되었습니다! 🔗',
      },
      confirm: {
        deleteEvent: '이 일정을 삭제하시겠습니까?',
        deleteTrip: '이 여행 전체를 삭제하시겠습니까? 되돌릴 수 없습니다.',
      },
      share: {
        copyPrompt: '이 링크를 복사하여 공유하세요:',
      },
      loading: '여행을 불러오는 중...',
      notFound: {
        title: '여행을 찾을 수 없습니다',
        desc: '잘못된 링크이거나 삭제된 여행일 수 있습니다.',
        goHome: '홈으로',
      },
      footer: {
        brand: '✈️ TripFlow',
        text: '함께 계획하고, 함께 여행하세요.',
      },
    },
  };

  // ── Display labels for language selector ──
  const localeLabels = {
    en: 'EN',
    ko: 'KO',
  };

  // ── Current locale ──
  let currentLocale = 'en';

  // ── Translate ──
  function t(key, params) {
    const keys = key.split('.');
    let val = locales[currentLocale];
    for (const k of keys) {
      val = val?.[k];
    }
    // Fallback to English
    if (val === undefined) {
      val = locales.en;
      for (const k of keys) {
        val = val?.[k];
      }
    }
    if (val === undefined) return key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        val = val.replace('{' + k + '}', v);
      }
    }
    return val;
  }

  // ── Locale helpers ──
  var dateLocaleMap = { en: 'en-US', ko: 'ko-KR' };

  function getDateLocale() {
    return dateLocaleMap[currentLocale] || currentLocale;
  }

  function getAvailableLocales() {
    return Object.keys(locales).map(function (code) {
      return { code: code, label: localeLabels[code] || code.toUpperCase() };
    });
  }

  // ── Apply translations to DOM ──
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.dataset.i18nTitle);
    });
    document.title = t('meta.title');
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = t('meta.description');
  }

  // ── Set locale ──
  function setLocale(lang) {
    currentLocale = locales[lang] ? lang : 'en';
    localStorage.setItem('tripflow-lang', currentLocale);
    document.documentElement.lang = currentLocale;
    applyI18n();
  }

  // ── Initialize locale ──
  (function initLocale() {
    var stored = localStorage.getItem('tripflow-lang');
    var browserLang = (navigator.language || '').slice(0, 2);
    currentLocale = stored || (locales[browserLang] ? browserLang : 'en');
    document.documentElement.lang = currentLocale;
  })();

  // ── Expose globally ──
  window.i18n = {
    t: t,
    setLocale: setLocale,
    applyI18n: applyI18n,
    getDateLocale: getDateLocale,
    getAvailableLocales: getAvailableLocales,
    get locale() { return currentLocale; },
  };
})();
