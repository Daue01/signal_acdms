export type StatePhoto = {
  src: string;
  alt: string;
  caption: string;
};

export const statePhotos: Record<string, StatePhoto[]> = {
  Abia: [
    {src: '/state-images/abia-azumini-river.jpg', alt: 'Blue water and green banks along the Azumini River in Abia State', caption: 'Azumini Blue River'},
  ],
  Adamawa: [
    {src: '/state-images/adamawa-aun-campus.jpg', alt: 'Campus grounds at the American University of Nigeria in Yola', caption: 'American University of Nigeria, Yola'},
  ],
  'Akwa Ibom': [
    {src: '/state-images/akwa-ibom-stadium.jpg', alt: 'Godswill Akpabio International Stadium in Uyo', caption: 'Uyo'},
  ],
  Anambra: [
    {src: '/state-images/anambra-agulu-lake.jpg', alt: 'Agulu Lake surrounded by vegetation in Anambra State', caption: 'Agulu Lake'},
    {src: '/state-images/anambra-onitsha-basilica.jpg', alt: 'Cathedral Basilica in Onitsha', caption: 'Onitsha'},
  ],
  Bauchi: [
    {src: '/state-images/bauchi-yankari-waterbuck.jpg', alt: 'Waterbuck in Yankari Game Reserve, Bauchi State', caption: 'Yankari Game Reserve'},
    {src: '/state-images/bauchi-wikki-spring.jpg', alt: 'Clear water at Wikki Warm Spring in Yankari', caption: 'Wikki Warm Spring'},
  ],
  Bayelsa: [
    {src: '/state-images/bayelsa-oloibiri.jpg', alt: 'Oloibiri, site of Nigeria’s first commercial oil discovery', caption: 'Oloibiri'},
    {src: '/state-images/bayelsa-yenagoa-statue.jpg', alt: 'A public monument in Yenagoa, Bayelsa State', caption: 'Yenagoa'},
  ],
  Benue: [
    {src: '/state-images/benue-river-sunset.jpg', alt: 'Sunset over the River Benue', caption: 'River Benue'},
  ],
  Borno: [
    {src: '/state-images/borno-state-contingent.jpg', alt: 'Cultural contingent representing Borno State', caption: 'Borno State'},
    {src: '/state-images/borno-kanuri-culture.jpg', alt: 'Kanuri traditional clothing and cultural display', caption: 'Kanuri culture'},
  ],
  'Cross River': [
    {src: '/state-images/cross-river-agbokim-falls.jpg', alt: 'Water cascading through forest at Agbokim Waterfalls', caption: 'Agbokim Waterfalls'},
    {src: '/state-images/cross-river-national-park.jpg', alt: 'Protected rainforest in Cross River National Park', caption: 'Cross River National Park'},
  ],
  Delta: [
    {src: '/state-images/delta-asaba-roundabout.jpg', alt: 'A roundabout in Asaba, Delta State', caption: 'Asaba'},
    {src: '/state-images/delta-polytechnic.jpg', alt: 'Delta State Polytechnic campus at Ogwashi-Uku', caption: 'Ogwashi-Uku'},
  ],
  Ebonyi: [
    {src: '/nigeria-guide/eastern-nigeria-map.jpg', alt: 'Historical map of Eastern Nigeria in 1958, before Ebonyi became a state', caption: 'Eastern Nigeria, 1958, before Ebonyi State was created'},
  ],
  Edo: [
    {src: '/state-images/edo-benin-city.jpg', alt: 'Aerial view of Benin City, Edo State', caption: 'Benin City'},
    {src: '/state-images/edo-somorika-hills.jpg', alt: 'Rocky hills and green landscape at Somorika in Edo State', caption: 'Somorika Hills'},
  ],
  Ekiti: [
    {src: '/state-images/ekiti-iworoko-mountain.jpg', alt: 'Iworoko Mountain in Ekiti State', caption: 'Iworoko Mountain'},
    {src: '/state-images/ekiti-arinta-waterfall.jpg', alt: 'Waterfall surrounded by forest at Arinta, Ipole-Iloro', caption: 'Arinta Waterfall'},
  ],
  Enugu: [
    {src: '/state-images/enugu-nsude-pyramids.jpg', alt: 'Archival photograph of the Nsude mud pyramids in Enugu State', caption: 'Nsude Pyramids, archival photograph'},
  ],
  FCT: [
    {src: '/state-images/fct-emblem.png', alt: 'Emblem of the Federal Capital Territory', caption: 'Federal Capital Territory'},
  ],
  Gombe: [
    {src: '/state-images/gombe-maize-farm.jpg', alt: 'Maize farm in Akko, Gombe State', caption: 'Akko'},
  ],
  Imo: [
    {src: '/state-images/imo-otamiri-river.jpg', alt: 'Otamiri River flowing through Egbu near Owerri', caption: 'Otamiri River'},
    {src: '/state-images/imo-owerri-city.jpg', alt: 'Cityscape of Owerri, Imo State', caption: 'Owerri'},
  ],
  Jigawa: [
    {src: '/state-images/jigawa-dutse-city.jpg', alt: 'Dutse, the capital of Jigawa State', caption: 'Dutse'},
    {src: '/state-images/jigawa-dutse-mosque.jpg', alt: 'Central mosque in Dutse, Jigawa State', caption: 'Dutse Central Mosque'},
  ],
  Kaduna: [
    {src: '/state-images/kaduna-zaria-palace.jpg', alt: 'Historic emir’s palace gate in Zaria, Kaduna State', caption: 'Zaria'},
    {src: '/state-images/kaduna-matsirga-falls.jpg', alt: 'Matsirga Waterfalls near Madakiya in Kaduna State', caption: 'Matsirga Waterfalls'},
  ],
  Kano: [
    {src: '/state-images/kano-city-aerial.jpg', alt: 'Aerial view of Kano city', caption: 'Kano City'},
    {src: '/state-images/kano-emirs-palace.jpg', alt: 'Kofar Kudu entrance to the Emir’s Palace in Kano', caption: 'Kofar Kudu'},
  ],
  Katsina: [
    {src: '/state-images/katsina-emir-palace.jpg', alt: 'Emir’s palace in Katsina State', caption: 'Katsina Emir’s Palace'},
  ],
  Kebbi: [
    {src: '/state-images/kebbi-argungu-festival.jpg', alt: 'Argungu Fishing Festival on the river in Kebbi State', caption: 'Argungu Fishing Festival'},
  ],
  Kogi: [
    {src: '/state-images/kogi-confluence.jpg', alt: 'Confluence of the Niger and Benue rivers at Lokoja', caption: 'Lokoja River Confluence'},
    {src: '/state-images/kogi-lokoja-view.jpg', alt: 'View over Lokoja and the Niger-Benue confluence', caption: 'Lokoja'},
  ],
  Kwara: [
    {src: '/state-images/kwara-ilorin-mosque.jpg', alt: 'Ilorin Central Mosque beside the Emir’s Palace', caption: 'Ilorin'},
    {src: '/state-images/kwara-innovation-hub.jpg', alt: 'Ilorin Innovation Hub in Kwara State', caption: 'Ilorin Innovation Hub'},
  ],
  Lagos: [
    {src: '/state-images/lagos-lekki-bridge.jpg', alt: 'Lekki-Ikoyi Link Bridge illuminated at night', caption: 'Lekki-Ikoyi Link Bridge'},
    {src: '/state-images/lagos-national-theatre.jpg', alt: 'National Theatre in Lagos', caption: 'National Theatre'},
  ],
  Nasarawa: [
    {src: '/state-images/nasarawa-keffi-hill.jpg', alt: 'Keffi town viewed from Maloney Hill', caption: 'Keffi'},
    {src: '/state-images/nasarawa-lafia-emir.jpg', alt: 'Emir’s palace in Lafia, Nasarawa State', caption: 'Lafia'},
  ],
  Niger: [
    {src: '/state-images/niger-minna-roundabout.jpg', alt: 'Bahago Roundabout in Minna, Niger State', caption: 'Minna'},
    {src: '/state-images/niger-minna-mosque.jpg', alt: 'Central Mosque in Minna, Niger State', caption: 'Minna Central Mosque'},
  ],
  Ogun: [
    {src: '/state-images/ogun-olumo-rock.jpg', alt: 'Olumo Rock in Abeokuta, Ogun State', caption: 'Olumo Rock'},
    {src: '/state-images/ogun-abeokuta.jpg', alt: 'Abeokuta city viewed across its rooftops', caption: 'Abeokuta'},
  ],
  Ondo: [
    {src: '/state-images/ondo-idanre-hills.jpg', alt: 'Idanre Hills rising above the town in Ondo State', caption: 'Idanre Hills'},
    {src: '/state-images/ondo-akure.jpg', alt: 'Aerial view across Akure, Ondo State', caption: 'Akure'},
  ],
  Osun: [
    {src: '/state-images/osun-sacred-grove.jpg', alt: 'Shrine and forest at the Osun-Osogbo Sacred Grove', caption: 'Osun-Osogbo Sacred Grove'},
    {src: '/state-images/osun-erin-ijesha-falls.jpg', alt: 'Erin-Ijesha Waterfall in Osun State', caption: 'Erin-Ijesha Waterfall'},
  ],
  Oyo: [
    {src: '/state-images/oyo-bower-tower.jpg', alt: 'Bower’s Tower in Ibadan, Oyo State', caption: 'Ibadan'},
    {src: '/state-images/oyo-ado-waye.jpg', alt: 'Rock formations at Ado-Awaye in Oyo State', caption: 'Ado-Awaye'},
  ],
  Plateau: [
    {src: '/state-images/plateau-wildlife-park.jpg', alt: 'Entrance to Jos Wildlife Park in Plateau State', caption: 'Jos Wildlife Park'},
    {src: '/state-images/plateau-kerang-highlands.jpg', alt: 'Highland landscape near Kerang in Plateau State', caption: 'Kerang Highlands'},
  ],
  Rivers: [
    {src: '/state-images/rivers-port-harcourt-tower.jpg', alt: 'A modern tower along a road in Port Harcourt', caption: 'Port Harcourt'},
    {src: '/state-images/rivers-bonny.jpg', alt: 'Bonny Island community and waterfront in Rivers State', caption: 'Bonny'},
  ],
  Sokoto: [
    {src: '/state-images/sokoto-sultan-palace.jpg', alt: 'Front entrance of the Sultan’s Palace in Sokoto', caption: 'Sokoto Sultan’s Palace'},
    {src: '/state-images/sokoto-tireta-forest.jpg', alt: 'Landscape at Tireta Forest in Sokoto State', caption: 'Tireta Forest'},
  ],
  Taraba: [
    {src: '/state-images/taraba-mambilla-plateau.jpg', alt: 'Green valleys and highlands of the Mambilla Plateau', caption: 'Mambilla Plateau'},
    {src: '/state-images/taraba-chappal-wadi.jpg', alt: 'Mountain landscape at Chappal Wadi in Taraba State', caption: 'Chappal Wadi'},
    {src: '/state-images/taraba-tea-farm.jpg', alt: 'Tea fields in Gembu on the Mambilla Plateau', caption: 'Gembu Tea Farm'},
  ],
  Yobe: [
    {src: '/state-images/yobe-nguru-river.jpg', alt: 'Boats along the Nguru River bank in Yobe State', caption: 'Nguru River'},
    {src: '/state-images/yobe-sahel-oasis.jpg', alt: 'Palm trees and water amid the Sahel landscape in Yobe State', caption: 'Sahel Oasis'},
  ],
  Zamfara: [
    {src: '/state-images/zamfara-kwatarkwashi.jpg', alt: 'Mountain Kwatarkwashi in Zamfara State', caption: 'Kwatarkwashi'},
    {src: '/state-images/zamfara-museum.jpg', alt: 'Gallery exhibits at Arewa House Museum featuring Zamfara State', caption: 'Zamfara Gallery'},
  ],
};
