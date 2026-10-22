import Image from 'next/image';
import GeopoliticalZoneExplorer from './GeopoliticalZoneExplorer';

export const metadata = {
  title: 'Nigeria: Geography and History | Naija Signal',
  description: 'An original guide to Nigeria’s landscapes, climate, rivers, regions and history.',
};

const timeline = [
  ['Before the colonial period', 'The territory now called Nigeria contained many societies and political traditions, including the Nok culture, the Kanem-Borno state, Hausa city-states, the Sokoto Caliphate, Yoruba kingdoms and cities, the Benin Kingdom, Igbo communities, and Niger Delta trading states. Their histories overlapped through trade, migration, scholarship, diplomacy and conflict; there was no single precolonial Nigerian state.'],
  ['Nineteenth century', 'Trade and political change reshaped the region. The Sokoto jihad beginning in 1804 led to a large caliphate across much of the north. In the south, Yoruba conflicts and changing Atlantic commerce influenced city-states and kingdoms. British commercial and military influence expanded along the coast and then inland.'],
  ['Colonial rule and amalgamation', 'Britain established separate Northern and Southern protectorates and formally amalgamated them in 1914. Colonial boundaries joined communities with different political systems and did not erase their local identities. Nationalist movements, labour groups and regional political organisations grew during the twentieth century.'],
  ['Independence and the First Republic', 'Nigeria became independent on 1 October 1960 and a republic in 1963. The country initially had three regions. In 1967, the regions were replaced by 12 states, a change that preceded the 1967 to 1970 civil war.'],
  ['A changing federation', 'Further state creation brought the total to 19 in 1976, 21 in 1987, 30 in 1991 and 36 in 1996. The Federal Capital Territory was established separately, and Abuja became the national capital in 1991. These changes were intended to bring government closer to communities and balance the federation.'],
  ['The Fourth Republic', 'Civilian democratic rule resumed in 1999. Nigeria today is a federal republic of 36 states and the FCT, with elected national and state institutions, local government areas and a great variety of languages, faiths and cultural practices.'],
];

function Photo({src, alt, caption}: {src: string; alt: string; caption: string}) {
  return (
    <figure className="guide-photo">
      <Image src={src} alt={alt} width={1200} height={760} sizes="(max-width: 760px) 100vw, 50vw" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function NigeriaGuide() {
  return (
    <main className="nigeria-guide">
      <a className="skip-link" href="#geography">Skip to guide content</a>
      <section className="guide-hero">
        <p className="eyebrow">A country guide / Nigeria</p>
        <h1>Land, people<br />and <em>time.</em></h1>
        <p>Nigeria is not one landscape or one story. Its geography runs from the Sahel to the Atlantic, while its history is made up of many societies, exchanges and political changes. This guide brings that larger picture together.</p>
        <div className="guide-hero-facts">
          <span><strong>923,768</strong> square kilometres</span>
          <span><strong>36</strong> states</span>
          <span><strong>1</strong> Federal Capital Territory</span>
          <span><strong>6</strong> geopolitical zones</span>
        </div>
      </section>

      <nav className="guide-section-nav" aria-label="Nigeria guide sections">
        <a href="#geography">Geography</a>
        <a href="#regions">States and regions</a>
        <a href="#history">History</a>
      </nav>

      <section className="guide-section guide-overview" id="geography">
        <div className="guide-section-heading">
          <p className="eyebrow">01 / Geography</p>
          <h2>A meeting place of<br /><em>ecosystems.</em></h2>
        </div>
        <div className="guide-copy">
          <p className="guide-lead">Nigeria occupies the western side of the Gulf of Guinea in West Africa. It shares land borders with Benin to the west, Niger to the north, Chad around Lake Chad to the northeast, and Cameroon to the east. Its southern edge meets the Atlantic Ocean.</p>
          <p>The country’s relief rises from a low, humid coastline through broad plains and river valleys to higher ground in the central plateau and eastern highlands. The Jos Plateau stands above the surrounding plains, while the Mambilla Plateau and the mountains along the Cameroon border form some of the country’s highest terrain. Chappal Waddi in the Gashaka and Gumti area is Nigeria’s highest peak.</p>
          <p>These differences matter in daily life: they shape growing seasons, transport routes, settlement patterns, water access and the kinds of crops and livelihoods that are possible in different places.</p>
        </div>
        <div className="guide-photo-pair">
          <Photo src="/nigeria-guide/topography.png" alt="Topographic map showing Nigeria’s highlands, plateaus, valleys and coastal lowlands" caption="Nigeria’s relief: from coastal lowlands to the central and eastern highlands." />
          <Photo src="/nigeria-guide/plateau.jpg" alt="Rolling green highlands and forest on the Mambilla Plateau" caption="The Mambilla Plateau in Taraba State, one of Nigeria’s elevated landscapes." />
        </div>
      </section>

      <section className="guide-section guide-landscapes">
        <div className="guide-section-heading">
          <p className="eyebrow">02 / Land and water</p>
          <h2>From dry north<br />to <em>delta coast.</em></h2>
        </div>
        <div className="guide-landscape-grid">
          <article><span>01 / North</span><h3>Sahel and savanna</h3><p>The far north grades into the Sahel, a semi-arid belt with a short rainy season and long dry months. South of it, Sudan and Guinea savannas support extensive farming and grazing. Rainfall generally increases toward the coast, though local patterns vary.</p></article>
          <article><span>02 / Central</span><h3>Plateaus and valleys</h3><p>Central Nigeria is a transition zone of open woodland, grassland, hills and river basins. The Jos Plateau has cooler highland conditions. The Niger and Benue meet at Lokoja, a striking geographic landmark and a major feature of the country’s drainage system.</p></article>
          <article><span>03 / South</span><h3>Rainforest and coast</h3><p>Southern Nigeria is generally wetter, with forest, farmland, lagoons and an Atlantic shoreline. The Niger spreads into a vast delta of distributaries, freshwater and tidal wetlands, mangroves and communities whose lives are closely connected to the water.</p></article>
          <article><span>04 / Seasons</span><h3>Rain and dry cycles</h3><p>Most of the country experiences a rainy season and a dry season, but their timing and length differ from north to south and from year to year. The Harmattan can bring dry, dusty air from the Sahara in the cooler months. Flooding and drought risk are both strongly shaped by local terrain and rainfall.</p></article>
        </div>
        <div className="guide-photo-pair">
          <Photo src="/nigeria-guide/climate-zones.webp" alt="Köppen-Geiger climate map of Nigeria" caption="Climate zones vary widely across the country; this map is a broad classification, not a local forecast." />
          <Photo src="/nigeria-guide/river-benue.jpg" alt="Sunset over the River Benue" caption="The River Benue joins the Niger at Lokoja before the river continues south to the Atlantic." />
        </div>
        <div className="guide-callout">
          <strong>Living with environmental change</strong>
          <p>Desertification and land pressure affect parts of the north; erosion and seasonal flooding affect many regions; and the low-lying Niger Delta faces flood, habitat and pollution pressures. These are related but distinct challenges, and solutions depend on local conditions and communities.</p>
        </div>
      </section>

      <section className="guide-section guide-regions" id="regions">
        <div className="guide-section-heading">
          <p className="eyebrow">03 / States and regions</p>
          <h2>One federation,<br /><em>many places.</em></h2>
        </div>
        <div className="guide-copy">
          <p className="guide-lead">Nigeria’s 36 states and the Federal Capital Territory are grouped into six geopolitical zones, often used for planning and public discussion. A zone is a convenient regional frame, not a single culture or a substitute for the histories and identities of its communities.</p>
          <p>States have their own elected governments and are divided into local government areas. Abuja is administered as the FCT rather than as a state. Nigeria has 774 local government areas across the states and the FCT’s area councils.</p>
        </div>
        <GeopoliticalZoneExplorer />
        <Photo src="/nigeria-guide/political-map.webp" alt="Political map of Nigeria showing state boundaries" caption="State boundaries help describe administration; the country’s cultural and physical regions do not always follow them." />
        <a className="guide-map-link" href="/#explore">Open the interactive map and view state signals <span>→</span></a>
      </section>

      <section className="guide-section guide-history" id="history">
        <div className="guide-section-heading">
          <p className="eyebrow">04 / History</p>
          <h2>Many roots.<br /><em>Shared futures.</em></h2>
        </div>
        <div className="guide-copy">
          <p className="guide-lead">The name Nigeria describes a modern country, but the histories of the people and places within it stretch back thousands of years. Communities built cities, kingdoms, trading networks, artistic traditions and systems of learning long before colonial rule.</p>
          <p>Because these histories are diverse, no short timeline can speak for every community. The milestones below show how the modern federation formed alongside, not in place of, older identities and local histories.</p>
        </div>
        <ol className="guide-timeline">
          {timeline.map(([period, detail], index) => (
            <li key={period}>
              <span>0{index + 1}</span>
              <div><h3>{period}</h3><p>{detail}</p></div>
            </li>
          ))}
        </ol>
        <div className="guide-history-note">
          <Photo src="/nigeria-guide/eastern-nigeria-map.jpg" alt="Historical map of Eastern Nigeria from 1958" caption="A 1958 map of Eastern Nigeria, before the states of today were created." />
          <div><p className="eyebrow">A note on place names</p><h3>Today’s map is only one layer.</h3><p>State boundaries have changed over time. They do not define the full extent of historic kingdoms, language communities, trade routes or ecological regions. Read state-level stories alongside local and community histories for a fuller picture.</p></div>
        </div>
      </section>

      <section className="guide-end">
        <p className="eyebrow">Keep exploring</p>
        <h2>Every place has<br />a <em>signal.</em></h2>
        <p>Explore the state map to see local photos and learn what makes each place distinct.</p>
        <a className="button button-primary" href="/#explore">Explore the state map <span>↗</span></a>
      </section>

      <footer className="guide-footer">
        <a href="/">Naija Signal</a>
        <span>A living guide to Nigeria’s places and people.</span>
        <a href="/#top">Back to home ↑</a>
      </footer>
    </main>
  );
}
