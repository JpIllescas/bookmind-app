import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  error(mensaje: string): void {
    toast.error(mensaje, { duration: 5000 });
  }

  exito(mensaje: string): void {
    toast.success(mensaje, { duration: 3500 });
  }
}
