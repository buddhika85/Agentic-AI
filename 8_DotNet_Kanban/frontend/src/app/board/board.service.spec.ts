import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BoardService } from './board.service';
import { BoardData } from '../models/board.models';

const EMPTY_BOARD: BoardData = { id: '1', name: 'Test', columns: [] };

describe('BoardService', () => {
  let service: BoardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BoardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ── Debounce ─────────────────────────────────────────────────────────────

  it('three updateBoard calls within 800ms result in exactly one POST', fakeAsync(() => {
    service.updateBoard(EMPTY_BOARD);
    service.updateBoard(EMPTY_BOARD);
    service.updateBoard(EMPTY_BOARD);

    tick(500);
    expect(http.match('/api/board').length).toBe(0); // debounce has not fired yet

    tick(300); // total elapsed: 800ms — debounce fires
    expect(http.match('/api/board').length).toBe(1);
  }));

  it('single updateBoard after 900ms fires exactly one POST', fakeAsync(() => {
    service.updateBoard(EMPTY_BOARD);
    tick(900);
    expect(http.match('/api/board').length).toBe(1);
  }));

  // ── Signal state ─────────────────────────────────────────────────────────

  it('updateBoard updates the board signal synchronously', fakeAsync(() => {
    const board: BoardData = { id: '42', name: 'My Board', columns: [] };
    service.updateBoard(board);
    expect(service.board()).toEqual(board);
    tick(800); // flush debounce timer
    http.match('/api/board'); // consume pending request so verify() passes
  }));

  // ── applyAiBoardUpdate ───────────────────────────────────────────────────

  it('applyAiBoardUpdate posts immediately without waiting 800ms', fakeAsync(() => {
    service.applyAiBoardUpdate(EMPTY_BOARD);
    // No tick — POST must already be in the queue
    expect(http.match('/api/board').length).toBe(1);
  }));

  it('applyAiBoardUpdate caps columns at 5 in both signal and POST body', fakeAsync(() => {
    const wideBoard: BoardData = {
      id: '1',
      name: 'Wide',
      columns: Array.from({ length: 7 }, (_, i) => ({
        id: String(i),
        title: `Col ${i}`,
        position: i,
        cards: [],
      })),
    };
    service.applyAiBoardUpdate(wideBoard);
    const [req] = http.match('/api/board');
    expect(req.request.body.board.columns.length).toBe(5);
    expect(service.board()!.columns.length).toBe(5);
  }));
});
