import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecommendedTrackOut } from './types';
import type { OpenCodeClient } from '../opencode/client';

const PREFIX = 'spotai_track_insight:';
const MODEL = { providerID: 'opencode', modelID: 'mimo-v2.5-free' };

function cacheKey(track: RecommendedTrackOut, context: string) {
  return `${PREFIX}${encodeURIComponent(`${track.spotify_url}|${context}`)}`;
}

export async function generateTrackInsight(client: OpenCodeClient, track: RecommendedTrackOut, context: string): Promise<string | null> {
  const key = cacheKey(track, context);
  const cached = await AsyncStorage.getItem(key);
  if (cached) return cached;

  const features = track.audio_features ?? {};
  const prompt = `Escreva em português do Brasil uma explicação de no máximo 2 frases sobre por que a faixa "${track.name}", de ${track.artist}, combina com a seleção "${context}". Use somente estes dados reais: gênero ${track.genre ?? 'indisponível'}, energia ${features.energy ?? 'indisponível'}, dançabilidade ${features.danceability ?? 'indisponível'}, valência ${features.valence ?? 'indisponível'}, acústica ${features.acousticness ?? 'indisponível'}, BPM ${features.tempo ?? 'indisponível'} e distância musical ${track.distance}. Não cite números, API, algoritmo, histórico nem invente fatos sobre letra. Responda apenas com a explicação.`;
  const session = await client.createSession();
  try {
    await client.sendPrompt(session.id, prompt, MODEL);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const messages = await client.getMessages(session.id);
      const answer = [...messages].reverse().find((message) => message.role === 'assistant')?.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.type === 'text' ? part.text : '')
        .join(' ')
        .trim();
      if (answer) {
        await AsyncStorage.setItem(key, answer);
        return answer;
      }
    }
    return null;
  } finally {
    client.deleteSession(session.id).catch(() => undefined);
  }
}
