import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { DetalleObra } from './detalle-obra';

describe('DetalleObra', () => {
  let fixture: ComponentFixture<DetalleObra>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleObra],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DetalleObra);
    fixture.detectChanges();
  });

  it('should render the selected artwork details', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Atardecer en el campo');
  });
});
