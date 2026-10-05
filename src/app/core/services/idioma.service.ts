import { Injectable, signal } from '@angular/core';

export type Idioma = 'es' | 'en';

type Traducciones = Record<string, string>;

const ES: Traducciones = {
  'nav.library': 'Biblioteca',
  'nav.upload': 'Subir documento',
  'nav.assistant': 'Asistente IA',
  'nav.progress': 'Mi progreso',
  'nav.workspace': 'Espacio de trabajo',
  'nav.editPlan': 'Editar mi plan de estudio',
  'nav.logout': 'Cerrar sesión',
  'nav.lightTheme': 'Tema claro',
  'nav.darkTheme': 'Tema oscuro',
  'nav.expand': 'Expandir la barra lateral',
  'nav.collapse': 'Plegar la barra lateral',
  'library.kicker': 'Tu biblioteca',
  'library.upload': 'Subir un libro',
  'library.retry': 'Reintentar',
  'library.loading': 'Cargando tu biblioteca',
  'library.emptyTitle': 'Aún no tienes documentos',
  'library.emptyText': 'Sube tu primer libro en PDF o EPUB. BookMind lo leerá, detectará su materia y armará el índice para poder citarte la página exacta.',
  'library.uploadFirst': 'Subir mi primer libro',
  'library.search': 'Buscar por título, autor o materia',
  'library.searchLabel': 'Buscar en tu biblioteca',
  'library.filters': 'Filtrar documentos',
  'library.all': 'Todos',
  'library.inProgress': 'En progreso',
  'library.noResults': 'Ningún documento coincide con la búsqueda.',
  'library.clearFilters': 'Limpiar filtros',
  'library.continue': 'Continuar',
  'library.readNext': 'Seguir leyendo',
  'library.add': 'Añadir un libro',
  'library.pdfEpub': 'PDF o EPUB',
  'library.deleteConfirm': '¿Eliminar este libro y todo lo generado?',
  'common.delete': 'Eliminar',
  'common.cancel': 'Cancelar',
  'common.finished': 'Terminado',
  'common.book': 'libro',
  'common.books': 'libros',
  'common.day': 'día',
  'common.days': 'días',
  'upload.title': 'Trae tu libro',
  'upload.kicker': 'Subir documento',
  'upload.choose': 'Arrastra un archivo aquí o haz clic para explorar',
  'upload.back': 'Volver a la biblioteca',
  'upload.tryAnother': 'Probar con otro archivo',
  'upload.open': 'Abrir el libro',
  'upload.goLibrary': 'Ir a la biblioteca',
  'assistant.kicker': 'Lumo, tu guía',
  'assistant.title': '¿Qué quieres estudiar hoy?',
  'assistant.search': 'Buscar',
  'assistant.searching': 'Buscando…',
  'assistant.upload': 'Subir documento',
  'progress.route': 'Ruta de aprendizaje',
  'progress.readings': 'Lecturas y planes',
};

const EN: Traducciones = {
  'nav.library': 'Library',
  'nav.upload': 'Upload document',
  'nav.assistant': 'AI assistant',
  'nav.progress': 'My progress',
  'nav.workspace': 'Workspace',
  'nav.editPlan': 'Edit my study plan',
  'nav.logout': 'Log out',
  'nav.lightTheme': 'Light theme',
  'nav.darkTheme': 'Dark theme',
  'nav.expand': 'Expand sidebar',
  'nav.collapse': 'Collapse sidebar',
  'library.kicker': 'Your library',
  'library.upload': 'Upload a book',
  'library.retry': 'Try again',
  'library.loading': 'Loading your library',
  'library.emptyTitle': 'You have no documents yet',
  'library.emptyText': 'Upload your first PDF or EPUB book. BookMind will read it, detect its subject, and build an index so it can cite the exact page.',
  'library.uploadFirst': 'Upload my first book',
  'library.search': 'Search by title, author, or subject',
  'library.searchLabel': 'Search your library',
  'library.filters': 'Filter documents',
  'library.all': 'All',
  'library.inProgress': 'In progress',
  'library.noResults': 'No document matches your search.',
  'library.clearFilters': 'Clear filters',
  'library.continue': 'Continue',
  'library.readNext': 'Continue reading',
  'library.add': 'Add a book',
  'library.pdfEpub': 'PDF or EPUB',
  'library.deleteConfirm': 'Delete this book and everything generated?',
  'common.delete': 'Delete',
  'common.cancel': 'Cancel',
  'common.finished': 'Finished',
  'common.book': 'book',
  'common.books': 'books',
  'common.day': 'day',
  'common.days': 'days',
  'upload.title': 'Bring your book',
  'upload.kicker': 'Upload document',
  'upload.choose': 'Drag a file here or click to browse',
  'upload.back': 'Back to library',
  'upload.tryAnother': 'Try another file',
  'upload.open': 'Open book',
  'upload.goLibrary': 'Go to library',
  'assistant.kicker': 'Lumo, your guide',
  'assistant.title': 'What do you want to study today?',
  'assistant.search': 'Search',
  'assistant.searching': 'Searching…',
  'assistant.upload': 'Upload document',
  'progress.route': 'Learning path',
  'progress.readings': 'Readings and plans',
};

@Injectable({ providedIn: 'root' })
export class IdiomaService {
  private static readonly CLAVE = 'bookmind.idioma';
  readonly idioma = signal<Idioma>(this.leerIdioma());

  cambiar(idioma: Idioma): void {
    this.idioma.set(idioma);
    if (typeof document !== 'undefined') document.documentElement.lang = idioma;
    try {
      localStorage.setItem(IdiomaService.CLAVE, idioma);
    } catch {
      // La preferencia permanece activa durante esta sesión.
    }
  }

  alternar(): void {
    this.cambiar(this.idioma() === 'es' ? 'en' : 'es');
  }

  traducir(clave: string): string {
    const catalogo = this.idioma() === 'en' ? EN : ES;
    return catalogo[clave] ?? clave;
  }

  private leerIdioma(): Idioma {
    try {
      return localStorage.getItem(IdiomaService.CLAVE) === 'en' ? 'en' : 'es';
    } catch {
      return 'es';
    }
  }
}
