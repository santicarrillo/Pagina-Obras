import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL } from '../../../core/data/legal';

@Component({
  selector: 'app-privacidad',
  imports: [RouterLink],
  templateUrl: './privacidad.html',
  styleUrl: '../legal.css',
})
export class Privacidad {
  readonly legal = LEGAL;
}
