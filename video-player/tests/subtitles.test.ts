import { describe, expect, it } from 'vitest';
import { cuesToVtt, parseSubtitles, parseTimecode, srtToVtt } from '../src/lib/subtitles';

const SRT = `﻿1\r\n00:00:01,000 --> 00:00:04,500\r\nHello <i>world</i>\r\n\r\n2\r\n00:01:02,250 --> 00:01:05,000\r\nSecond line\r\nwraps here\r\n`;

describe('subtitles', () => {
  it('converts SRT to VTT', () => {
    const vtt = srtToVtt(SRT);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:04.500');
    expect(vtt).not.toContain('\r');
  });

  it('parses SRT and VTT into identical cues', () => {
    const fromSrt = parseSubtitles(SRT);
    const fromVtt = parseSubtitles(srtToVtt(SRT));
    expect(fromSrt).toEqual(fromVtt);
    expect(fromSrt).toHaveLength(2);
    expect(fromSrt[1]).toMatchObject({ start: 62.25, end: 65, text: 'Second line\nwraps here' });
  });

  it('parses VTT cue settings and short timestamps', () => {
    const cues = parseSubtitles('WEBVTT\n\nNOTE comment\n\nintro\n00:05.5 --> 00:07.000 align:start line:90%\nHi\n');
    expect(cues).toEqual([{ start: 5.5, end: 7, text: 'Hi', settings: { align: 'start', line: '90%' } }]);
  });

  it('round-trips through cuesToVtt', () => {
    const cues = parseSubtitles(SRT);
    expect(parseSubtitles(cuesToVtt(cues)).map(({ start, end, text }) => ({ start, end, text }))).toEqual(cues.map(({ start, end, text }) => ({ start, end, text })));
  });

  it('parses timecodes', () => {
    expect(parseTimecode('01:00:00,001')).toBeCloseTo(3600.001);
    expect(Number.isNaN(parseTimecode('junk'))).toBe(true);
  });
});
