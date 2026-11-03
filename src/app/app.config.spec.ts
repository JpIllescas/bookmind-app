import { HttpBackend, HttpXhrBackend } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { appConfig } from './app.config';

describe('appConfig', () => {
  it('usa XHR: con fetch la barra de subida se queda en 0 % hasta que el archivo termina de llegar', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    expect(TestBed.inject(HttpBackend)).toBeInstanceOf(HttpXhrBackend);
  });
});
