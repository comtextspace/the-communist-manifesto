import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

// Получаем __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация
const CONFIG = {
    dataDir: './data',
    templateFile: './template.html',
    outputFile: './dist/index.html',
    distDir: './dist'
};

// Флаги языков
const LANGUAGE_FLAGS = {
    'ru': '🇷🇺',
    'en': '🇬🇧',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'es': '🇪🇸',
    'it': '🇮🇹',
    'pt': '🇵🇹',
    'zh': '🇨🇳',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'ar': '🇸🇦',
    'hi': '🇮🇳'
};

/**
 * Читает файл и возвращает его содержимое
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Ошибка чтения файла ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Парсер inline Markdown для абзацев (заголовки, жирный, курсив, сноски)
 */
function parseInlineMarkdown(text, footnotes = [], langCode = '', addColorToBold = false) {
    let html = text;
    
    // Проверяем, является ли строка заголовком
    const headerMatch = text.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
        const level = headerMatch[1].length;
        let headerText = headerMatch[2];
        
        // Обрабатываем сноски в заголовках
        headerText = headerText.replace(/\[\^(\d+)\]/g, (match, footnoteId) => {
            const footnote = footnotes.find(f => f.id === footnoteId);
            if (footnote) {
                const uniqueId = langCode ? `${langCode}-${footnoteId}` : footnoteId;
                return `<sup><a href="#" class="footnote-link" data-footnote="${uniqueId}" onclick="showFootnote(event, '${uniqueId}')">i</a></sup>`;
            }
            return match;
        });
        
        // Обрабатываем форматирование в заголовках
        headerText = headerText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        headerText = headerText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return `<h${level} class="column-header">${headerText}</h${level}>`;
    }
    
    // Обработка ссылок на сноски [^1] - заменяем на всплывающие ссылки с уникальным ID
    html = html.replace(/\[\^(\d+)\]/g, (match, footnoteId) => {
        const footnote = footnotes.find(f => f.id === footnoteId);
        if (footnote) {
            const uniqueId = langCode ? `${langCode}-${footnoteId}` : footnoteId;
            return `<sup><a href="#" class="footnote-link" data-footnote="${uniqueId}" onclick="showFootnote(event, '${uniqueId}')">i</a></sup>`;
        }
        return match;
    });
    
    // Выделение жирным **текст** - с красным цветом или без
    if (addColorToBold) {
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-highlight">$1</strong>');
    } else {
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
    
    // Выделение курсивом *текст*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    return html;
}

/**
 * Простой парсер Markdown для header.md
 */
function parseMarkdown(markdown) {
    let html = markdown;
    let footnotes = [];

    // Сначала находим все определения сносок
    // Более точный подход - ищем сноски построчно
    const lines = markdown.split('\n');
    const processedLines = [];
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        const footnoteMatch = line.match(/^\[\^(\d+)\]:\s*(.*)$/);
        
        if (footnoteMatch) {
            const footnoteId = footnoteMatch[1];
            let footnoteText = footnoteMatch[2];
            
            // Собираем многострочные сноски
            i++;
            while (i < lines.length) {
                const nextLine = lines[i];
                // Останавливаемся если встретили новую сноску или заголовок
                if (nextLine.match(/^\[\^(\d+)\]:/) || nextLine.match(/^#{1,6}\s/)) {
                    break;
                }
                // Если пустая строка, останавливаемся
                if (nextLine.trim() === '') {
                    i++; // Пропускаем пустую строку
                    break;
                }
                footnoteText += ' ' + nextLine.trim();
                i++;
            }
            
            // Обрабатываем форматирование в тексте сноски
            let formattedText = footnoteText.trim();
            // Сначала обрабатываем жирный (две звездочки) - используем негативный lookahead/lookbehind
            formattedText = formattedText.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
            // Потом курсив (одна звездочка) - но не те, что часть **
            formattedText = formattedText.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
            
            footnotes.push({ id: footnoteId, text: formattedText });
        } else {
            processedLines.push(line);
            i++;
        }
    }
    
    // Используем обработанные строки без сносок
    html = processedLines.join('\n');

    // Обработка ссылок на сноски [^1] - заменяем на всплывающие ссылки с префиксом "header"
    html = html.replace(/\[\^(\d+)\]/g, (match, footnoteId) => {
        const footnote = footnotes.find(f => f.id === footnoteId);
        if (footnote) {
            const uniqueId = `header-${footnoteId}`;
            return `<sup><a href="#" class="footnote-link" data-footnote="${uniqueId}" onclick="showFootnote(event, '${uniqueId}')">i</a></sup>`;
        }
        return match;
    });

    // Заголовки (до 6 уровня)
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Выделение жирным **текст**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Выделение курсивом *текст*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Ссылки [текст]([[N]]) - оглавление со ссылками на абзацы
    html = html.replace(/\[([^\]]+)\]\(\[\[(\d+)\]\]\)/g, (match, text, paragraphNum) => {
        return `<a href="#paragraph-${paragraphNum}" class="paragraph-link" onclick="scrollToParagraph(event, ${paragraphNum})">${text}</a>`;
    });

    // Ссылки на абзацы [[N]] - преобразуем в якоря (для случаев без текста)
    html = html.replace(/\[\[(\d+)\]\]/g, (match, paragraphNum) => {
        return `<a href="#paragraph-${paragraphNum}" class="paragraph-link" onclick="scrollToParagraph(event, ${paragraphNum})">${paragraphNum}</a>`;
    });

    // Ссылки [текст](url) - обычные внешние ссылки
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Горизонтальная линия (---)
    html = html.replace(/^---\s*$/gm, '<hr>');

    // Списки - обрабатываем перед разбиением на абзацы
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Обрабатываем переносы строк
    // Сначала разбиваем на абзацы по двойным переносам
    const paragraphs = html.split(/\n\s*\n/);
    
    // Обрабатываем каждый абзац
    html = paragraphs.map(paragraph => {
        paragraph = paragraph.trim();
        if (!paragraph) return '';
        
        // Если абзац уже содержит HTML теги (заголовки, списки, горизонтальная линия), оставляем как есть
        if (paragraph.match(/^<[h1-6]|^<ul|^<hr/)) {
            return paragraph;
        }
        
        // Иначе обрабатываем переносы строк внутри абзаца
        paragraph = paragraph.replace(/\n/g, '<br>');
        return `<p>${paragraph}</p>`;
    }).filter(p => p).join('\n');

    // Добавляем префикс "header" к ID сносок для уникальности
    const uniqueFootnotes = footnotes.map(f => ({
        id: `header-${f.id}`,
        text: f.text
    }));

    return { html, footnotes: uniqueFootnotes };
}

/**
 * Записывает содержимое в файл
 */
function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Файл ${filePath} успешно создан`);
    } catch (error) {
        console.error(`Ошибка записи файла ${filePath}:`, error.message);
    }
}

/**
 * Парсит конфигурационный файл языка
 * Формат: первая строка - название языка (до # для меню, после # для кнопок), пустая строка, абзацы, опционально сноски
 */
function parseLanguageFile(filePath, langCode = '') {
    const content = readFile(filePath);
    if (!content) return null;

    const lines = content.trim().split('\n');
    if (lines.length < 2) {
        console.error(`Файл ${filePath} должен содержать минимум 2 строки (название языка + хотя бы один абзац)`);
        return null;
    }

    // Парсим первую строку: "Название для меню # Название для кнопок"
    const firstLine = lines[0];
    const parts = firstLine.split('#');
    const menuName = parts[0].trim(); // До # - для верхнего меню
    const buttonName = parts.length > 1 ? parts[1].trim() : ''; // После # - для кнопок (может быть пустым)
    
    // Парсим сноски и обычный текст
    const footnotes = [];
    const processedLines = [];
    let i = 1; // Пропускаем первую строку (название языка)
    
    while (i < lines.length) {
        const line = lines[i];
        const footnoteMatch = line.match(/^\[\^(\d+)\]:\s*(.*)$/);
        
        if (footnoteMatch) {
            const footnoteId = footnoteMatch[1];
            let footnoteText = footnoteMatch[2];
            
            // Собираем многострочные сноски
            i++;
            while (i < lines.length) {
                const nextLine = lines[i];
                // Останавливаемся если встретили новую сноску или заголовок
                if (nextLine.match(/^\[\^(\d+)\]:/) || nextLine.match(/^#{1,6}\s/)) {
                    break;
                }
                // Если пустая строка, останавливаемся
                if (nextLine.trim() === '') {
                    i++; // Пропускаем пустую строку
                    break;
                }
                footnoteText += ' ' + nextLine.trim();
                i++;
            }
            
            // Обрабатываем форматирование в тексте сноски
            let formattedText = footnoteText.trim();
            // Сначала обрабатываем жирный (две звездочки) - с красным цветом для языковых файлов
            formattedText = formattedText.replace(/\*\*([^*]+?)\*\*/g, '<strong class="text-highlight">$1</strong>');
            // Потом курсив (одна звездочка) - но не те, что часть **
            formattedText = formattedText.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
            
            footnotes.push({ id: footnoteId, text: formattedText });
        } else if (line.trim().length > 0) {
            processedLines.push(line);
            i++;
        } else {
            // Пустая строка - просто пропускаем
            i++;
        }
    }
    
    // Применяем Markdown к каждому абзацу, передавая langCode для уникальных ID сносок
    // Для языковых файлов добавляем красный цвет к жирному тексту
    const paragraphs = processedLines
        .filter(line => line.trim().length > 0)
        .map(paragraph => parseInlineMarkdown(paragraph, footnotes, langCode, true));

    // Добавляем префикс langCode к ID сносок для уникальности
    const uniqueFootnotes = footnotes.map(f => ({
        id: langCode ? `${langCode}-${f.id}` : f.id,
        text: f.text
    }));

    return {
        name: menuName,          // Полное название для меню
        buttonName: buttonName,  // Короткое название для кнопок (может быть пустым)
        paragraphs: paragraphs,
        footnotes: uniqueFootnotes
    };
}

/**
 * Получает код языка и вариант из имени файла 
 * Например: text-ru.md -> {lang: 'ru', variant: null}
 *           text-ru-1.md -> {lang: 'ru', variant: '1'}
 */
function getLanguageInfoFromFilename(filename) {
    const match = filename.match(/text-([a-z]{2})(?:-(\d+))?\.md$/);
    if (match) {
        return {
            lang: match[1],
            variant: match[2] || null,
            fullCode: match[2] ? `${match[1]}-${match[2]}` : match[1]
        };
    }
    return null;
}

/**
 * Загружает config.yaml
 */
function loadYamlConfig() {
    const configPath = path.join(CONFIG.dataDir, 'config.yaml');
    try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.parse(fileContent);
        console.log('✅ Загружена конфигурация из config.yaml');
        return config;
    } catch (error) {
        console.warn('⚠️  Файл config.yaml не найден, используются значения по умолчанию');
        return {
            title: 'параллельный текст - многоязычная книга',
            siteName: 'параллельный текст',
            settings: {
                maxColumns: 4,
                minColumns: 1,
                defaultTheme: 'light'
            }
        };
    }
}

/**
 * Загружает все конфигурационные файлы
 */
function loadConfigFiles() {
    const dataDir = CONFIG.dataDir;
    
    // Проверяем существование папки data
    if (!fs.existsSync(dataDir)) {
        console.error(`❌ Папка ${dataDir} не найдена`);
        return null;
    }

    const files = fs.readdirSync(dataDir);
    const config = {
        header: null,
        languages: {},
        yaml: loadYamlConfig()
    };

    // Загружаем header.md
    const headerFile = path.join(dataDir, 'header.md');
    if (fs.existsSync(headerFile)) {
        const headerContent = readFile(headerFile);
        if (headerContent) {
            const parsed = parseMarkdown(headerContent.trim());
            config.header = parsed.html;
            config.footnotes = parsed.footnotes;
        }
    } else {
        console.warn(`⚠️  Файл ${headerFile} не найден, используется заглушка`);
        config.header = '<h2 class="book-title">Многоязычная книга</h2><p class="book-author">Автор</p>';
        config.footnotes = [];
    }

    // Загружаем файлы языков
    const languageFiles = files.filter(file => file.startsWith('text-') && file.endsWith('.md'));
    
    if (languageFiles.length === 0) {
        console.error(`❌ Не найдено ни одного файла языка в формате text-XX.md`);
        return null;
    }

    console.log(`📚 Найдено файлов языков: ${languageFiles.length}`);

    // Каждый файл - отдельная колонка
    for (const file of languageFiles.sort()) {
        const langInfo = getLanguageInfoFromFilename(file);
        if (!langInfo) {
            console.warn(`⚠️  Не удалось определить код языка из файла ${file}`);
            continue;
        }

        const filePath = path.join(dataDir, file);
        const languageData = parseLanguageFile(filePath, langInfo.fullCode);
        
        if (languageData) {
            config.languages[langInfo.fullCode] = {
                name: languageData.name,           // Полное название для меню
                buttonName: languageData.buttonName, // Короткое название для кнопок
                paragraphs: languageData.paragraphs,
                baseLang: langInfo.lang,
                variant: langInfo.variant,
                footnotes: languageData.footnotes || []
            };
            
            // Объединяем сноски из всех файлов (теперь с уникальными ID)
            if (languageData.footnotes && languageData.footnotes.length > 0) {
                config.footnotes = [...config.footnotes, ...languageData.footnotes];
            }
            
            console.log(`✅ Загружен язык: ${langInfo.fullCode} (${languageData.name}) - ${languageData.paragraphs.length} абзацев, ${languageData.footnotes ? languageData.footnotes.length : 0} сносок`);
        }
    }

    return config;
}

/**
 * Генерирует HTML для контролов колонок
 */
function generateColumnControls(languages) {
    const langCodes = Object.keys(languages);
    
    return langCodes.map(langCode => {
        const language = languages[langCode];
        // Получаем базовый язык для флага (ru-1 -> ru)
        const baseLang = language.baseLang || langCode;
        const flag = LANGUAGE_FLAGS[baseLang] || '🌐';
        
        return `
                    <div class="column-control" data-lang-code="${langCode}">
                        <input type="checkbox" id="lang-${langCode}" class="column-checkbox" checked onchange="toggleColumn('${langCode}')">
                        <label for="lang-${langCode}" class="column-label">
                            <span>${flag}</span>
                            <span>${language.name}</span>
                        </label>
                        <div class="order-buttons">
                            <button class="order-btn" onclick="moveLangUp('${langCode}')" title="Вверх">↑</button>
                            <button class="order-btn" onclick="moveLangDown('${langCode}')" title="Вниз">↓</button>
                        </div>
                    </div>`;
    }).join('\n');
}

/**
 * Генерирует HTML для колонок языков
 */
function generateLanguageColumns(languages) {
    const langCodes = Object.keys(languages);
    const maxParagraphs = Math.max(...Object.values(languages).map(lang => lang.paragraphs.length));
    
    return langCodes.map(langCode => {
        const language = languages[langCode];
        // Получаем базовый язык для флага (ru-1 -> ru)
        const baseLang = language.baseLang || langCode;
        const flag = LANGUAGE_FLAGS[baseLang] || '🌐';
        
        const paragraphsHtml = language.paragraphs.map((paragraph, index) => {
            return `
                <div class="paragraph" data-paragraph="${index + 1}" data-lang="${langCode}" id="paragraph-${langCode}-${index + 1}">
                    <div class="paragraph-number">${index + 1}</div>
                    <div class="paragraph-text">
                        ${paragraph}
                    </div>
                </div>`;
        }).join('\n');

        return `
            <!-- ${language.name} -->
            <div class="language-column" data-lang="${langCode}">
                <div class="language-header">
                    <div class="language-flag">${flag}</div>
                    <div class="language-name">${language.name}</div>
                </div>
                ${paragraphsHtml}
            </div>`;
    }).join('\n');
}

/**
 * Генерирует HTML для мобильной версии - все выбранные языки друг за другом
 */
function generateMobileParagraphs(languages) {
    const langCodes = Object.keys(languages).sort(); // Сортируем для единообразия
    const maxParagraphs = Math.max(...Object.values(languages).map(lang => lang.paragraphs.length));
    
    let html = '';
    
    // Для каждого абзаца показываем все языки друг за другом
    for (let i = 0; i < maxParagraphs; i++) {
        const paragraphNum = i + 1;
        
        // Генерируем контент для каждого языка (все показываются, порядок будет изменен через CSS/JS)
        const languageContents = langCodes.map(langCode => {
            const language = languages[langCode];
            const baseLang = language.baseLang || langCode;
            const flag = LANGUAGE_FLAGS[baseLang] || '🌐';
            
            // Проверяем, есть ли этот абзац в данном языке
            if (i < language.paragraphs.length) {
                return `
                    <div class="mobile-paragraph-item" data-lang="${langCode}">
                        <div class="paragraph" data-paragraph="${paragraphNum}" data-lang="${langCode}" id="paragraph-${langCode}-${paragraphNum}">
                            <div class="paragraph-number">
                                <span class="paragraph-flag">${flag}</span>
                                <span class="paragraph-num">${paragraphNum}</span>
                            </div>
                            <div class="paragraph-text">
                                ${language.paragraphs[i]}
                            </div>
                        </div>
                    </div>`;
            }
            return '';
        }).filter(content => content).join('\n');
        
        html += `
            <div class="mobile-paragraph-group" data-paragraph="${paragraphNum}">
                ${languageContents}
            </div>`;
    }
    
    return html;
}

/**
 * Генерирует кнопки для фиксированной панели языков на мобильном (не используется)
 */
function generateMobileLangButtons(languages) {
    // Эта функция больше не используется, но оставляем для совместимости
    return '';
}

/**
 * Генерирует CSS для выравнивания абзацев
 */
function generateParagraphAlignmentCSS(maxParagraphs) {
    let css = '';
    for (let i = 1; i <= maxParagraphs; i++) {
        css += `
        .paragraph[data-paragraph="${i}"] {
            margin-top: 0;
        }`;
    }
    return css;
}

/**
 * Основная функция генерации
 */
function generateHTML() {
    console.log('🚀 Начинаем генерацию HTML...');
    
    // Загружаем конфигурацию
    const config = loadConfigFiles();
    if (!config) {
        console.error('❌ Не удалось загрузить конфигурационные файлы');
        return;
    }

    const languages = config.languages;
    const langCodes = Object.keys(languages);
    
    if (langCodes.length === 0) {
        console.error('❌ Не найдено ни одного языка для генерации');
        return;
    }

    // Читаем шаблон
    const template = readFile(CONFIG.templateFile);
    if (!template) {
        console.error('❌ Не удалось прочитать шаблон');
        return;
    }

    // Генерируем данные для замены
    const maxParagraphs = Math.max(...Object.values(languages).map(lang => lang.paragraphs.length));
    const paragraphNumbers = Array.from({length: maxParagraphs}, (_, i) => `"${i + 1}"`).join(', ');
    
    // По умолчанию показываем первые 4 языка
    const defaultVisibleColumns = langCodes.slice(0, 4);
    
    const replacements = {
        '{{TITLE}}': config.yaml.title || 'параллельный текст - многоязычная книга',
        '{{SITE_NAME}}': config.yaml.siteName || 'параллельный текст',
        '{{HEADER_CONTENT}}': config.header,
        '{{COLUMN_CONTROLS}}': generateColumnControls(languages),
        '{{LANGUAGE_COLUMNS}}': generateLanguageColumns(languages),
        '{{MOBILE_PARAGRAPHS}}': generateMobileParagraphs(languages),
        '{{MOBILE_LANG_BUTTONS}}': generateMobileLangButtons(languages),
        '{{VISIBLE_COLUMNS}}': JSON.stringify(defaultVisibleColumns),
        '{{ALL_LANGUAGES}}': JSON.stringify(langCodes),
        '{{PARAGRAPH_NUMBERS}}': `[${paragraphNumbers}]`,
        '{{FOOTNOTES}}': JSON.stringify(config.footnotes || [])
    };

    // Заменяем плейсхолдеры в шаблоне
    let html = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Добавляем CSS для выравнивания абзацев
    const paragraphCSS = generateParagraphAlignmentCSS(maxParagraphs);
    html = html.replace('</style>', `${paragraphCSS}\n    </style>`);

    // Создаем каталог dist если его нет
    if (!fs.existsSync(CONFIG.distDir)) {
        fs.mkdirSync(CONFIG.distDir, { recursive: true });
        console.log(`📁 Создан каталог ${CONFIG.distDir}`);
    }

    // Записываем результат
    writeFile(CONFIG.outputFile, html);
    
    console.log('🎉 Генерация завершена успешно!');
    console.log(`📊 Статистика:`);
    console.log(`   - Языков: ${langCodes.length}`);
    console.log(`   - Абзацев: ${maxParagraphs}`);
    console.log(`   - Выходной файл: ${CONFIG.outputFile}`);
}

// Запускаем генерацию
if (import.meta.url === `file://${process.argv[1]}`) {
    generateHTML();
}

export { generateHTML, loadConfigFiles, parseLanguageFile };
