import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL } from '../../../core/data/legal';

@Component({
  selector: 'app-terminos',
  imports: [RouterLink],
  templateUrl: './terminos.html',
  styleUrl: '../legal.css',
})
export class Terminos {
  readonly legal = LEGAL;
}
