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
    expect(http.match('/api/boards/1').length).toBe(0); // debounce has not fired yet

    tick(300); // total elapsed: 800ms — debounce fires
    expect(http.match('/api/boards/1').length).toBe(1);
  }));

  it('single updateBoard after 900ms fires exactly one POST', fakeAsync(() => {
    service.updateBoard(EMPTY_BOARD);
    tick(900);
    expect(http.match('/api/boards/1').length).toBe(1);
  }));

  // ── Signal state ─────────────────────────────────────────────────────────

  it('updateBoard updates the board signal synchronously', fakeAsync(() => {
    const board: BoardData = { id: '42', name: 'My Board', columns: [] };
    service.updateBoard(board);
    expect(service.board()).toEqual(board);
    tick(800); // flush debounce timer
    http.match('/api/boards/42'); // consume pending request so verify() passes
  }));

  // ── applyAiBoardUpdate ───────────────────────────────────────────────────

  it('applyAiBoardUpdate posts immediately without waiting 800ms', fakeAsync(() => {
    service.applyAiBoardUpdate(EMPTY_BOARD);
    // No tick — POST must already be in the queue
    expect(http.match('/api/boards/1').length).toBe(1);
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
    const [req] = http.match('/api/boards/1');
    expect(req.request.body.board.columns.length).toBe(5);
    expect(service.board()!.columns.length).toBe(5);
  }));

  // ── Board list ────────────────────────────────────────────────────────────

  it('listBoards fetches from /api/boards and updates boards signal', fakeAsync(() => {
    const summaries = [
      { id: '1', name: 'Board A', createdAt: '2024-01-01', updatedAt: '2024-01-02', cardCount: 3 },
      { id: '2', name: 'Board B', createdAt: '2024-01-01', updatedAt: '2024-01-03', cardCount: 5 },
    ];
    service.listBoards();
    tick();
    const req = http.expectOne('/api/boards');
    req.flush(summaries);
    tick();
    expect(service.boards().length).toBe(2);
    expect(service.boards()[0].name).toBe('Board A');
  }));

  it('createBoard posts to /api/boards and adds summary to boards signal', fakeAsync(() => {
    const newBoard: BoardData = { id: '99', name: 'New Board', columns: [] };
    let result: any;
    service.createBoard('New Board').then(s => result = s);
    tick();
    const req = http.expectOne('/api/boards');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'New Board' });
    req.flush(newBoard);
    tick();
    expect(result.id).toBe('99');
    expect(service.boards().length).toBe(1);
    expect(service.boards()[0].name).toBe('New Board');
  }));

  it('deleteBoard removes board from boards signal', fakeAsync(() => {
    // Pre-populate boards signal
    service['boards'].set([
      { id: '1', name: 'Board A', createdAt: '', updatedAt: '', cardCount: 0 },
      { id: '2', name: 'Board B', createdAt: '', updatedAt: '', cardCount: 0 },
    ]);
    service.deleteBoard('1');
    tick();
    const req = http.expectOne('/api/boards/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    tick();
    expect(service.boards().length).toBe(1);
    expect(service.boards()[0].id).toBe('2');
  }));

  it('loadBoard with id fetches /api/boards/{id}', fakeAsync(() => {
    service.loadBoard('42');
    tick();
    const req = http.expectOne('/api/boards/42');
    req.flush(EMPTY_BOARD);
    tick();
    expect(service.board()?.id).toBe('1');
  }));

  it('loadBoard without id falls back to /api/board', fakeAsync(() => {
    service.loadBoard();
    tick();
    const req = http.expectOne('/api/board');
    req.flush(EMPTY_BOARD);
    tick();
    expect(service.board()?.id).toBe('1');
  }));
});
