document.addEventListener('DOMContentLoaded', () => {
    // --- Globals and Constants ---
    const timelineContainer = document.querySelector('.timeline-container');
    const langButtons = {
        ko: document.getElementById('lang-ko'),
        en: document.getElementById('lang-en'),
    };
    let mymap = null;
    let allActivities = [];
    let currentLang = 'ko';

    const UI_STRINGS = {
        ko: {
            pageTitle: "나의 비개발 활동 기록",
            headerTitle: "나의 비개발 활동 타임라인",
            footerText: `&copy; ${new Date().getFullYear()} 내 인생 타임라인`,
            viewMore: "자세히 보기",
            viewLess: "간략히 보기",
            backToBlog: "블로그로 돌아가기"
        },
        en: {
            pageTitle: "My Non-Developer Activities",
            headerTitle: "My Non-Developer Activity Timeline",
            footerText: `&copy; ${new Date().getFullYear()} My Life Timeline`,
            viewMore: "View More",
            viewLess: "View Less",
            backToBlog: "Back to Blog"
        }
    };

    // --- Functions ---

    function initMap() {
        if (mymap) {
            mymap.remove();
        }
        mymap = L.map('mapid');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mymap);
    }

    function setMapBounds(activities) {
        const latLngs = activities.filter(a => a.latitude && a.longitude).map(a => [a.latitude, a.longitude]);
        if (latLngs.length > 0) {
            const bounds = L.latLngBounds(latLngs);
            mymap.fitBounds(bounds, { padding: [50, 50] });
        } else {
            mymap.setView([37.5665, 126.9780], 10); // Default to Seoul
        }
    }

    function updateUIText(lang) {
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-translate-key]').forEach(el => {
            const key = el.dataset.translateKey;
            if (UI_STRINGS[lang][key]) {
                el.innerHTML = UI_STRINGS[lang][key];
            }
        });

        // Update language button active state
        Object.values(langButtons).forEach(btn => btn.classList.remove('active'));
        if (langButtons[lang]) {
            langButtons[lang].classList.add('active');
        }
    }

    function renderTimeline(activities, lang) {
        timelineContainer.innerHTML = '';
        if (!mymap) initMap();
        
        // Clear previous markers
        mymap.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                mymap.removeLayer(layer);
            }
        });

        activities.forEach((activity, index) => {
            const title = activity.title[lang] || activity.title.ko;
            const description = activity.description[lang] || activity.description.ko;
            const fullContent = activity.full_content[lang] || activity.full_content.ko;

            const timelineItem = document.createElement('div');
            timelineItem.className = `timeline-item ${index % 2 === 0 ? 'left' : 'right'}`;

            const imageUrl = activity.images && activity.images.length > 0 ? activity.images[0] : '';
            
            timelineItem.innerHTML = `
                <div class="timeline-content">
                    <div class="timeline-image-wrapper" style="${!imageUrl ? 'display:none;' : ''}">
                        <img src="${imageUrl}" alt="${title}" class="timeline-image">
                        <div class="image-nav-arrows">
                            <span class="arrow left-arrow">&lt;</span>
                            <span class="arrow right-arrow">&gt;</span>
                        </div>
                        <div class="image-gallery-nav">
                            ${activity.images.map((_, i) => `<span class="dot" data-image-index="${i}"></span>`).join('')}
                        </div>
                    </div>
                    <h3 class="timeline-title">${title}</h3>
                    <p class="timeline-date">${activity.date.split(' ')[0]}</p>
                    <p class="timeline-description">${description}</p>
                    <div class="full-content" style="display:none;">${fullContent}</div>
                    <button class="toggle-content-btn">
                        ${UI_STRINGS[lang].viewMore} <span class="arrow-toggle">&#9660;</span>
                    </button>
                </div>
            `;
            timelineContainer.appendChild(timelineItem);

            // Image gallery logic
            if (activity.images && activity.images.length > 1) {
                let currentImageIndex = 0;
                const imgElement = timelineItem.querySelector('.timeline-image');
                const dots = timelineItem.querySelectorAll('.dot');
                dots[currentImageIndex].classList.add('active');

                const updateImage = (newIndex) => {
                    imgElement.src = activity.images[newIndex];
                    dots.forEach((dot, i) => dot.classList.toggle('active', i === newIndex));
                    currentImageIndex = newIndex;
                };

                timelineItem.querySelector('.left-arrow').addEventListener('click', e => {
                    e.stopPropagation();
                    updateImage((currentImageIndex - 1 + activity.images.length) % activity.images.length);
                });
                timelineItem.querySelector('.right-arrow').addEventListener('click', e => {
                    e.stopPropagation();
                    updateImage((currentImageIndex + 1) % activity.images.length);
                });
                dots.forEach(dot => dot.addEventListener('click', e => {
                     e.stopPropagation();
                     updateImage(parseInt(e.target.dataset.imageIndex));
                }));
            } else {
                 timelineItem.querySelector('.image-nav-arrows').style.display = 'none';
                 timelineItem.querySelector('.image-gallery-nav').style.display = 'none';
            }

            // Toggle full content
            const toggleBtn = timelineItem.querySelector('.toggle-content-btn');
            toggleBtn.addEventListener('click', () => {
                const fullContentDiv = timelineItem.querySelector('.full-content');
                const arrowSpan = toggleBtn.querySelector('.arrow-toggle');
                const isHidden = fullContentDiv.style.display === 'none';
                fullContentDiv.style.display = isHidden ? 'block' : 'none';
                toggleBtn.innerHTML = `${isHidden ? UI_STRINGS[lang].viewLess : UI_STRINGS[lang].viewMore} <span class="arrow-toggle">${isHidden ? '&#9650;' : '&#9660;'}</span>`;
            });

            // Map marker logic
            if (activity.latitude && activity.longitude) {
                const marker = L.marker([activity.latitude, activity.longitude]).addTo(mymap);
                marker.bindPopup(`<b>${title}</b><br>${description}`);
                
                timelineItem.addEventListener('mouseover', () => marker.openPopup());
                timelineItem.addEventListener('mouseout', () => marker.closePopup());
                timelineItem.addEventListener('click', () => mymap.flyTo([activity.latitude, activity.longitude], 13));
            }
        });
    }

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('activitiesLang', lang);
        updateUIText(lang);
        renderTimeline(allActivities, lang);
    }

    // --- Initialization ---

    // Add event listeners to language buttons
    Object.values(langButtons).forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    // Fetch data and initialize
    fetch('/assets/data/activities.json')
        .then(response => response.json())
        .then(activities => {
            allActivities = activities.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            initMap();
            setMapBounds(allActivities);

            const savedLang = localStorage.getItem('activitiesLang');
            const browserLang = navigator.language.split('-')[0];
            const initialLang = savedLang || (browserLang === 'ko' ? 'ko' : 'en');
            
            setLanguage(initialLang);
        })
        .catch(error => {
            console.error('Error fetching or processing activities:', error);
            timelineContainer.innerHTML = '<p style="text-align: center;">활동 데이터를 불러오는 데 실패했습니다.</p>';
        });
});