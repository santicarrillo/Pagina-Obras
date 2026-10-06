import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAX_REDES, Red, TIPOS_RED, TipoRed, armarUrl } from '../../core/data/redes';

interface Fila {
  tipo: TipoRed;
  valor: string;
}

// Lista editable de redes: elegir cuál es, pegar el usuario o link, agregar o quitar
@Component({
  selector: 'app-editor-redes',
  imports: [FormsModule],
  templateUrl: './editor-redes.html',
  styleUrl: './editor-redes.css',
})
export class EditorRedes implements OnInit {
  inicial = input<Red[]>([]);
  mostrarErrores = input(false);
  cambio = output<{ redes: Red[]; validas: boolean }>();

  readonly tipos = TIPOS_RED;
  readonly MAX = MAX_REDES;
  filas = signal<Fila[]>([]);

  ngOnInit() {
    this.filas.set(this.inicial().map(r => ({ tipo: r.tipo, valor: r.url })));
    this.avisar();
  }

  agregar() {
    if (this.filas().length >= MAX_REDES) return;
    const usados = new Set(this.filas().map(f => f.tipo));
    const libre = TIPOS_RED.find(t => !usados.has(t.tipo) && t.tipo !== 'otra')?.tipo ?? 'otra';
    this.filas.update(f => [...f, { tipo: libre, valor: '' }]);
    this.avisar();
  }

  quitar(i: number) {
    this.filas.update(f => f.filter((_, j) => j !== i));
    this.avisar();
  }

  ejemplo(tipo: TipoRed) {
    return TIPOS_RED.find(t => t.tipo === tipo)?.ejemplo ?? '';
  }

  invalida(f: Fila) {
    return armarUrl(f.tipo, f.valor) === null;
  }

  // Cada vez que cambia algo, le pasa al formulario la lista lista para guardar
  avisar() {
    const filas = this.filas().filter(f => f.valor.trim());
    const redes = filas.map(f => ({ tipo: f.tipo, url: armarUrl(f.tipo, f.valor) }));
    this.cambio.emit({
      redes: redes.filter((r): r is Red => r.url !== null),
      validas: redes.every(r => r.url !== null)
    });
  }
}
