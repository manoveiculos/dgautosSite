/**
 * SEO & AI Schema Generator (JSON-LD)
 * DG Automóveis - Structured Data for Google Rich Results, ChatGPT & Perplexity
 */

import { LOJA, CONTATO, SOCIAL } from './manos';
import type { Vehicle } from '../services/stockService';

export function generateAutoDealerSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': 'https://dgautomoveis.com.br/#dealer',
    'name': LOJA.nome,
    'description': 'Revenda de carros seminovos revisados com procedência e garantia no Alto Vale do Itajaí.',
    'url': 'https://dgautomoveis.com.br',
    'telephone': '+5547989169598',
    'logo': LOJA.logoUrl,
    'image': 'https://dgautomoveis.com.br/fachada-dg.png',
    'priceRange': '$$$',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'R. Dom Pedro II, 461',
      'addressLocality': 'Rio do Sul',
      'addressRegion': 'SC',
      'postalCode': '89164-138',
      'addressCountry': 'BR',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': -27.2207243,
      'longitude': -49.6539853,
    },
    'openingHoursSpecification': [
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '08:00',
        'closes': '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Saturday'],
        'opens': '08:00',
        'closes': '13:00',
      },
    ],
    'sameAs': [SOCIAL.instagram, SOCIAL.google, SOCIAL.reclameAqui],
    'areaServed': [
      'Rio do Sul',
      'Lontras',
      'Laurentino',
      'Agronômica',
      'Ibirama',
      'Trombudo Central',
      'Alto Vale do Itajaí',
      'Santa Catarina',
    ],
  };
}

export function generateVehicleSchema(vehicle: Vehicle) {
  const kmNumber = parseInt((vehicle.km || '0').replace(/\D/g, '')) || 0;
  const yearNumber = parseInt(vehicle.year || '2022') || 2022;

  return {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    'name': vehicle.description,
    'description': `${vehicle.description} - Ano ${vehicle.year}, ${vehicle.km}. Disponível na DG Automóveis em Rio do Sul/SC.`,
    'image': [vehicle.image],
    'url': vehicle.link || `https://dgautomoveis.com.br/?veiculo=${vehicle.id}`,
    'vehicleModelDate': String(yearNumber),
    'mileageFromOdometer': {
      '@type': 'QuantitativeValue',
      'value': kmNumber,
      'unitCode': 'KMT',
    },
    'itemCondition': 'https://schema.org/UsedCondition',
    'offers': {
      '@type': 'Offer',
      'price': vehicle.price,
      'priceCurrency': 'BRL',
      'availability': 'https://schema.org/InStock',
      'itemCondition': 'https://schema.org/UsedCondition',
      'seller': {
        '@type': 'AutoDealer',
        'name': LOJA.nome,
        'telephone': '+5547989169598',
      },
    },
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map((faq) => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer,
      },
    })),
  };
}

export function generateItemListSchema(vehicles: Vehicle[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'itemListElement': vehicles.slice(0, 15).map((vehicle, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': vehicle.description,
      'url': vehicle.link || `https://dgautomoveis.com.br/?veiculo=${vehicle.id}`,
    })),
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url,
    })),
  };
}
