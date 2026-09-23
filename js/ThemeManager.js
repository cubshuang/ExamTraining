/**
 * ThemeManager.js - UI 多樣式與排版管理模組
 * 負責：主題切換 (科技藍、深色暗黑、清新薄荷、暖陽米紙、雅緻紫羅)、字體大小調節、偏好記憶與彈窗選單
 */

var ThemeManager = (function() {
    // 支援的主題清單
    var THEMES = [
        {
            id: 'blue',
            name: '科技湛藍',
            desc: '經典現代藍調，專業穩健',
            primaryColor: '#2563eb',
            bgColor: '#f1f5f9'
        },
        {
            id: 'dark',
            name: '深色暗黑',
            desc: '夜間護眼模式，低眩光對比',
            primaryColor: '#60a5fa',
            bgColor: '#0f172a'
        },
        {
            id: 'green',
            name: '清新薄荷',
            desc: '舒緩草木綠意，緩解視力疲勞',
            primaryColor: '#059669',
            bgColor: '#f0fdf4'
        },
        {
            id: 'sepia',
            name: '暖陽米紙',
            desc: '書籍溫潤紙質，柔和不刺眼',
            primaryColor: '#b45309',
            bgColor: '#fbf8f1'
        },
        {
            id: 'purple',
            name: '雅緻紫羅',
            desc: '現代沉靜紫韻，專注沉著',
            primaryColor: '#7c3aed',
            bgColor: '#faf5ff'
        }
    ];

    // 字體大小等級
    var FONT_SIZES = [
        { id: 'normal', name: '標準', scale: '100%' },
        { id: 'medium', name: '舒適', scale: '112%' },
        { id: 'large', name: '放大', scale: '125%' }
    ];

    var STORAGE_KEY_THEME = 'exam_app_theme';
    var STORAGE_KEY_FONT = 'exam_app_font_size';

    var currentTheme = 'blue';
    var currentFontSize = 'normal';

    /**
     * 取得預設主題配置
     */
    function getDefaultConfig() {
        var cfg = (typeof examSettings !== 'undefined' && examSettings.uiTheme)
            ? examSettings.uiTheme
            : (window.uiThemeSettings || {});

        return {
            defaultTheme: cfg.defaultTheme || 'blue',
            defaultFontSize: cfg.defaultFontSize || 'normal'
        };
    }

    /**
     * 套用主題
     */
    function setTheme(themeId) {
        var exists = THEMES.some(function(t) { return t.id === themeId; });
        if (!exists) themeId = 'blue';

        currentTheme = themeId;
        document.documentElement.setAttribute('data-theme', themeId);

        try {
            localStorage.setItem(STORAGE_KEY_THEME, themeId);
        } catch (e) {
            console.warn('無法存取 localStorage:', e);
        }

        updateDropdownActiveState();
    }

    /**
     * 套用字體大小
     */
    function setFontSize(sizeId) {
        var exists = FONT_SIZES.some(function(f) { return f.id === sizeId; });
        if (!exists) sizeId = 'normal';

        currentFontSize = sizeId;
        document.documentElement.setAttribute('data-font-size', sizeId);

        try {
            localStorage.setItem(STORAGE_KEY_FONT, sizeId);
        } catch (e) {
            console.warn('無法存取 localStorage:', e);
        }

        updateDropdownActiveState();
    }

    /**
     * 初始化載入偏好 (優先 localStorage，其次 config)
     */
    function loadSavedPreferences() {
        var defaults = getDefaultConfig();
        var savedTheme = defaults.defaultTheme;
        var savedFont = defaults.defaultFontSize;

        try {
            var localTheme = localStorage.getItem(STORAGE_KEY_THEME);
            if (localTheme) savedTheme = localTheme;
            var localFont = localStorage.getItem(STORAGE_KEY_FONT);
            if (localFont) savedFont = localFont;
        } catch (e) {
            console.warn('讀取 localStorage 失敗:', e);
        }

        setTheme(savedTheme);
        setFontSize(savedFont);
    }

    /**
     * 建立並渲染樣式切換按鈕與浮動面板
     */
    function initUI() {
        var wrapper = document.getElementById('themeSwitchWrapper');
        if (!wrapper) {
            var headerLeft = document.querySelector('.header-left');
            if (!headerLeft) return;

            wrapper = document.createElement('div');
            wrapper.className = 'theme-switch-wrapper';
            wrapper.id = 'themeSwitchWrapper';

            wrapper.innerHTML = '<button type="button" class="btn-theme-trigger" id="btnThemeTrigger" title="選擇外觀主題與排版樣式" aria-haspopup="true" aria-expanded="false">'
                + '  <span class="theme-icon">🎨</span>'
                + '  <span class="theme-btn-text">樣式</span>'
                + '</button>'
                + '<div class="theme-dropdown-popover" id="themeDropdownPopover" style="display: none;" role="dialog" aria-label="樣式設定">'
                + '  <div class="popover-header">'
                + '    <h4>🎨 外觀風格與排版</h4>'
                + '    <button type="button" class="btn-close-popover" id="btnCloseThemePopover" title="關閉">✕</button>'
                + '  </div>'
                + '  <div class="popover-body">'
                + '    <div class="theme-section">'
                + '      <div class="section-title">主題配色</div>'
                + '      <div class="theme-options-grid" id="themeOptionsGrid"></div>'
                + '    </div>'
                + '    <div class="theme-section">'
                + '      <div class="section-title">字體排版</div>'
                + '      <div class="font-options-row" id="fontOptionsRow"></div>'
                + '    </div>'
                + '  </div>'
                + '</div>';

            headerLeft.appendChild(wrapper);
        }

        // 渲染主題選項
        var grid = wrapper.querySelector('#themeOptionsGrid');
        THEMES.forEach(function(t) {
            var item = document.createElement('div');
            item.className = 'theme-opt-item' + (t.id === currentTheme ? ' active' : '');
            item.setAttribute('data-theme-id', t.id);
            item.innerHTML = '<div class="theme-color-preview" style="background-color: ' + t.bgColor + '; border: 2px solid ' + t.primaryColor + ';">'
                + '  <span class="color-dot" style="background-color: ' + t.primaryColor + ';"></span>'
                + '</div>'
                + '<div class="theme-info">'
                + '  <div class="theme-title">' + t.name + '</div>'
                + '  <div class="theme-sub">' + t.desc + '</div>'
                + '</div>'
                + '<span class="theme-check-mark">✓</span>';

            item.addEventListener('click', function() {
                setTheme(t.id);
            });
            grid.appendChild(item);
        });

        // 渲染字體選項
        var fontRow = wrapper.querySelector('#fontOptionsRow');
        FONT_SIZES.forEach(function(f) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'font-opt-btn' + (f.id === currentFontSize ? ' active' : '');
            btn.setAttribute('data-font-id', f.id);
            btn.innerHTML = f.name + ' <span class="font-scale-tag">(' + f.scale + ')</span>';

            btn.addEventListener('click', function() {
                setFontSize(f.id);
            });
            fontRow.appendChild(btn);
        });

        // 綁定彈出開關事件
        var trigger = wrapper.querySelector('#btnThemeTrigger');
        var popover = wrapper.querySelector('#themeDropdownPopover');
        var closeBtn = wrapper.querySelector('#btnCloseThemePopover');

        function togglePopover(show) {
            var isVisible = (popover.style.display === 'block');
            var nextState = (typeof show === 'boolean') ? show : !isVisible;
            popover.style.display = nextState ? 'block' : 'none';
            trigger.setAttribute('aria-expanded', nextState ? 'true' : 'false');
            if (nextState) {
                wrapper.classList.add('popover-open');
            } else {
                wrapper.classList.remove('popover-open');
            }
        }

        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePopover();
        });

        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePopover(false);
        });

        // 點擊彈窗內部不關閉
        popover.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // 點擊外部關閉
        document.addEventListener('click', function() {
            togglePopover(false);
        });

        // 按 Esc 關閉
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                togglePopover(false);
            }
        });

        updateDropdownActiveState();
    }

    /**
     * 同步更新選單內的 active 標籤狀態
     */
    function updateDropdownActiveState() {
        var grid = document.getElementById('themeOptionsGrid');
        if (grid) {
            grid.querySelectorAll('.theme-opt-item').forEach(function(el) {
                var tid = el.getAttribute('data-theme-id');
                if (tid === currentTheme) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }

        var fontRow = document.getElementById('fontOptionsRow');
        if (fontRow) {
            fontRow.querySelectorAll('.font-opt-btn').forEach(function(el) {
                var fid = el.getAttribute('data-font-id');
                if (fid === currentFontSize) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }
    }

    /**
     * 模組初始化
     */
    function init() {
        loadSavedPreferences();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initUI);
        } else {
            initUI();
        }
    }

    // 立即載入儲存的偏好樣式，防止畫面閃爍
    loadSavedPreferences();

    return {
        init: init,
        setTheme: setTheme,
        setFontSize: setFontSize,
        getTheme: function() { return currentTheme; },
        getFontSize: function() { return currentFontSize; },
        themes: THEMES,
        fontSizes: FONT_SIZES
    };
})();
